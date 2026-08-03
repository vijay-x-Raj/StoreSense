"""
AI service — multimodal reasoning using OpenAI GPT-4o.
Combines video analytics, sales, inventory, and transcript context.
Falls back to deterministic rule-based responses if no API key is set.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.models import AIInsight
from app.services.video_service import get_video_analytics, _mock_analytics
from app.services.inventory_service import get_inventory_summary
from app.services.sales_service import get_sales_summary
from app.models.models import Transcript, ProductRequest


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ---------------------------------------------------------------------------
# Context Builder
# ---------------------------------------------------------------------------

def _build_context(session_id: Optional[int], db: Session) -> Dict[str, Any]:
    """Collect all available data as structured context for the LLM."""
    video_data = get_video_analytics(session_id, db) if session_id else _mock_analytics()
    inventory_data = get_inventory_summary(db)
    sales_data = get_sales_summary(db)

    # Transcript snippets
    transcripts = (
        db.query(Transcript)
        .filter(Transcript.session_id == session_id)
        .order_by(Transcript.start_time)
        .limit(20)
        .all()
        if session_id
        else []
    )
    transcript_text = "\n".join(
        f"[{t.start_time:.1f}s] {t.speaker}: {t.text}" for t in transcripts
    ) or "Sample transcript:\n[3.2s] Customer: Bhaiya ek Amul doodh dena.\n[12.1s] Customer: Give me two Coca Cola please."

    # Product requests
    products = (
        db.query(ProductRequest)
        .filter(ProductRequest.session_id == session_id)
        .all()
        if session_id
        else []
    )
    product_list = [f"- {p.product_name} x{p.quantity}" for p in products] or [
        "- Amul Milk x2",
        "- Coca Cola x2",
        "- Lays Chips x1",
    ]

    return {
        "video": video_data,
        "inventory": {
            "total_items": inventory_data["total_items"],
            "low_stock_count": inventory_data["low_stock_count"],
            "out_of_stock_count": inventory_data["out_of_stock_count"],
            "alerts": inventory_data["alerts"][:5],
        },
        "sales": {
            "today_revenue": sales_data["today_revenue"],
            "items_sold": sales_data["total_items_sold"],
            "conversion_rate": sales_data.get("conversion_rate", 73),
            "top_products": sales_data["top_products"][:5],
        },
        "transcript_snippet": transcript_text,
        "products_requested": product_list,
    }


SYSTEM_PROMPT = """You are StoreSense AI, an intelligent retail analytics assistant for Kirana stores and small businesses in India.

You have access to real-time data from:
1. CCTV video analysis (customer count, dwell time, queue length, peak hours)
2. Audio transcripts (Hindi/English/Hinglish customer conversations)
3. Inventory levels (current stock, low stock alerts)
4. Sales data (revenue, top products, conversion rate)

Respond in a concise, actionable, business-friendly tone. Use INR (₹) for currency.
Always base your answers on the provided context data. If asked for recommendations, be specific.
Keep responses under 200 words unless a detailed report is requested."""


# ---------------------------------------------------------------------------
# AI Query
# ---------------------------------------------------------------------------

def query_ai(
    query: str,
    session_id: Optional[int],
    db: Session,
) -> Dict[str, Any]:
    """Answer a business question using multimodal context."""
    context = _build_context(session_id, db)
    context_sources = ["video_analytics", "inventory", "sales", "transcript"]

    if OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)
            response = client.responses.create(
                model="gpt-4o",
                instructions=SYSTEM_PROMPT,
                input=f"""
Business Context:
{json.dumps(context, indent=2, default=str)}

User Question: {query}
""",
            )
            answer = response.output_text
        except Exception as e:
            answer = _rule_based_response(query, context)
    else:
        answer = _rule_based_response(query, context)

    # Cache in DB
    insight = AIInsight(
        session_id=session_id,
        insight_type="query_response",
        query=query,
        response=answer,
        context_json={"sources": context_sources},
    )
    db.add(insight)
    db.commit()

    return {
        "query": query,
        "response": answer,
        "context_used": context_sources,
    }


def generate_daily_summary(session_id: Optional[int], db: Session) -> Dict[str, Any]:
    """Auto-generate daily business intelligence report."""
    context = _build_context(session_id, db)
    v = context["video"]
    s = context["sales"]
    inv = context["inventory"]

    if OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)
            prompt = f"""Generate a concise daily business summary report for a Kirana store.
Context: {json.dumps(context, indent=2, default=str)}
Include: key metrics, what went well, what needs attention, and 2-3 actionable recommendations."""
            response = client.responses.create(
                model="gpt-4o",
                instructions=SYSTEM_PROMPT,
                input=prompt,
            )
            summary = response.output_text
        except Exception:
            summary = _mock_summary(v, s, inv)
    else:
        summary = _mock_summary(v, s, inv)

    alerts = [a["product_name"] + " is " + a["alert_type"].replace("_", " ") for a in inv["alerts"]]
    recommendations = _generate_recommendations(v, s, inv)

    insight = AIInsight(
        session_id=session_id,
        insight_type="daily_summary",
        query="daily_summary",
        response=summary,
    )
    db.add(insight)
    db.commit()

    return {
        "summary": summary,
        "key_metrics": {
            "total_customers": v["total_customers"],
            "revenue": s["today_revenue"],
            "conversion_rate": s["conversion_rate"],
            "peak_hour": v["peak_hour"],
            "low_stock_items": inv["low_stock_count"],
        },
        "recommendations": recommendations,
        "alerts": alerts,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Fallback: Rule-based responses
# ---------------------------------------------------------------------------

def _rule_based_response(query: str, context: Dict[str, Any]) -> str:
    """Deterministic answers when OpenAI key is unavailable."""
    q = query.lower()
    v = context["video"]
    s = context["sales"]
    inv = context["inventory"]

    if any(w in q for w in ["sales", "revenue", "low", "why"]):
        top = s["top_products"][0]["name"] if s["top_products"] else "Amul Milk"
        return (
            f"Today's revenue is ₹{s['today_revenue']:,.2f} with a conversion rate of {s['conversion_rate']}%. "
            f"Your top-selling product is {top}. "
            f"Peak traffic is at {v['peak_hour']}. "
            f"Consider stocking up on {inv['alerts'][0]['product_name'] if inv['alerts'] else 'popular items'} "
            f"which is running low."
        )
    elif any(w in q for w in ["restock", "stock", "inventory", "order"]):
        if inv["alerts"]:
            items = ", ".join(a["product_name"] for a in inv["alerts"][:3])
            return f"You should restock: {items}. These items are below their reorder threshold. Order from your supplier before tomorrow's rush hour at {v['peak_hour']}."
        return "All inventory levels are currently above reorder thresholds. Good stock management!"
    elif any(w in q for w in ["busy", "hour", "peak", "traffic"]):
        return (
            f"Your busiest hour today is {v['peak_hour']} with approximately "
            f"{max(c['customers'] for c in v['customers_by_hour'])} customers. "
            f"Total footfall: {v['total_customers']} customers. "
            f"Average time in store: {v['avg_dwell_time_seconds'] // 60:.0f} minutes."
        )
    elif any(w in q for w in ["queue", "cashier", "counter"]):
        return (
            f"Current queue length is {v['queue_length']} customers. "
            f"During peak hours ({v['peak_hour']}), queues tend to spike. "
            "Recommendation: Add one additional cashier between 5 PM and 8 PM to reduce wait times below 5 minutes."
        )
    elif any(w in q for w in ["hindi", "language", "hinglish"]):
        return (
            "Most customer requests are in Hindi/Hinglish. "
            "Top requested items in Hindi: Amul Doodh (Milk), Chips, Coke, Maggi. "
            "Consider labeling shelves in both Hindi and English for better navigation."
        )
    elif any(w in q for w in ["left", "without buying", "conversion"]):
        lost = 100 - s["conversion_rate"]
        return (
            f"Approximately {lost:.1f}% of visitors ({int(v['total_customers'] * lost / 100)} customers) "
            f"left without making a purchase. "
            "Common reasons: items out of stock (especially Parle-G, Bread), long queue wait times. "
            "Recommendation: Ensure top-10 items are always in stock."
        )
    else:
        return (
            f"Based on today's data: {v['total_customers']} customers visited, "
            f"revenue is ₹{s['today_revenue']:,.2f}, conversion rate is {s['conversion_rate']}%. "
            f"Peak hour: {v['peak_hour']}. {inv['low_stock_count']} items need restocking. "
            "Ask me anything specific about sales, inventory, customers, or queue management!"
        )


def _mock_summary(v: Dict, s: Dict, inv: Dict) -> str:
    return (
        f"📊 Daily Business Report — {datetime.now().strftime('%d %b %Y')}\n\n"
        f"Today {v['total_customers']} customers visited your store. "
        f"Revenue stands at ₹{s['today_revenue']:,.2f} with a strong conversion rate of {s['conversion_rate']}%. "
        f"Peak traffic was recorded at {v['peak_hour']}. "
        f"Average customer dwell time: {v['avg_dwell_time_seconds'] // 60:.0f} minutes.\n\n"
        f"⚠️ Inventory Alerts: {inv['low_stock_count']} items are below reorder level, "
        f"including {', '.join(a['product_name'] for a in inv['alerts'][:2])}.\n\n"
        f"💡 Recommendations:\n"
        f"1. Restock {inv['alerts'][0]['product_name'] if inv['alerts'] else 'dairy items'} immediately.\n"
        f"2. Add one cashier during {v['peak_hour']} to reduce queue wait time.\n"
        f"3. Top revenue driver today: {s['top_products'][0]['name'] if s['top_products'] else 'Amul Milk'} — "
        f"ensure 30+ units available daily."
    )


def _generate_recommendations(v: Dict, s: Dict, inv: Dict) -> List[str]:
    recs = []
    if v["queue_length"] > 5:
        recs.append(f"Add a cashier during {v['peak_hour']} — current queue: {v['queue_length']} customers.")
    if inv["out_of_stock_count"] > 0:
        out = [a["product_name"] for a in inv["alerts"] if a["alert_type"] == "out_of_stock"]
        recs.append(f"Urgent restock needed: {', '.join(out[:2])}.")
    if inv["low_stock_count"] > 0:
        low = [a["product_name"] for a in inv["alerts"] if a["alert_type"] == "low_stock"]
        recs.append(f"Place reorder for: {', '.join(low[:3])}.")
    if s["conversion_rate"] < 70:
        recs.append("Conversion rate below 70% — check product availability and shelf visibility.")
    if not recs:
        recs.append("Operations look healthy today. Keep monitoring inventory levels.")
    return recs
