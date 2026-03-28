import "./index.css";
import { createRoot } from "react-dom/client";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root was not found.");
}

const root = createRoot(container);

const renderBootstrapError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error("AgentOS failed to boot", error);
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#6679a6 0%,#3a334c 48%,#121520 100%);padding:24px;font-family:'Segoe UI Variable','Segoe UI',system-ui,sans-serif;">
      <div style="max-width:560px;border:1px solid rgba(255,255,255,0.12);border-radius:28px;background:rgba(9,11,18,0.42);box-shadow:0 24px 80px rgba(5,8,17,0.3);backdrop-filter:blur(22px);padding:24px;color:rgba(255,255,255,0.92);">
        <div style="font-size:18px;font-weight:700;">AgentOS could not finish loading</div>
        <div style="margin-top:10px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.72);">
          A startup error blocked the app before React mounted. Refresh once, and if it still fails, reopen the app or check the console.
        </div>
        <pre style="margin-top:16px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;color:#ffd7d7;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:14px;">${message}</pre>
      </div>
    </div>
  `;
};

async function bootstrap() {
  try {
    const { default: App } = await import("./App.tsx");
    root.render(<App />);
  } catch (error) {
    renderBootstrapError(error);
  }
}

void bootstrap();
