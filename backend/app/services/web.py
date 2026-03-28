import logging
from typing import Optional
from app.services.runtime_config import get_runtime_value

logger = logging.getLogger(__name__)


def _client():
    from tavily import TavilyClient
    key = get_runtime_value("TAVILY_API_KEY")
    if not key:
        raise ValueError("TAVILY_API_KEY not set")
    return TavilyClient(api_key=key)


def web_search(query: str, max_results: int = 5) -> dict:
    try:
        r = _client().search(query=query, max_results=max_results, include_answer=True)
        results = [
            {"title": x.get("title",""), "url": x.get("url",""),
             "snippet": x.get("content","")[:400], "score": round(x.get("score",0),3)}
            for x in r.get("results", [])
        ]
        return {"success": True, "answer": r.get("answer",""), "results": results,
                "description": f"Found {len(results)} results for: {query}"}
    except Exception as e:
        logger.error(f"web_search: {e}")
        return {"success": False, "results": [], "description": str(e)}


def web_extract(url: str) -> dict:
    try:
        r = _client().extract(urls=[url])
        pages = r.get("results", [])
        if not pages:
            return {"success": False, "url": url, "content": "", "description": f"No content from {url}"}
        content = pages[0].get("raw_content", "")
        truncated = content[:5000] + ("..." if len(content) > 5000 else "")
        return {"success": True, "url": url, "content": truncated,
                "full_length": len(content), "description": f"Extracted {len(content)} chars"}
    except Exception as e:
        logger.error(f"web_extract: {e}")
        return {"success": False, "url": url, "content": "", "description": str(e)}


def web_qna(question: str) -> dict:
    try:
        answer = _client().qna_search(query=question)
        return {"success": True, "question": question, "answer": answer,
                "description": f"Answer: {str(answer)[:200]}"}
    except Exception as e:
        logger.error(f"web_qna: {e}")
        return {"success": False, "answer": "", "description": str(e)}


def web_crawl(url: str, instructions: Optional[str] = None) -> dict:
    try:
        kw = {"instructions": instructions} if instructions else {}
        r = _client().crawl(url, **kw)
        pages = r.get("results", [])
        summary = [{"url": p.get("url",""), "snippet": p.get("raw_content","")[:300]}
                   for p in pages[:6]]
        return {"success": True, "base_url": url, "pages_found": len(pages),
                "pages": summary, "description": f"Crawled {len(pages)} pages from {url}"}
    except Exception as e:
        logger.error(f"web_crawl: {e}")
        return {"success": False, "pages": [], "description": str(e)}
