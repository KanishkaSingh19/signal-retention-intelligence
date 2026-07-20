import { useState } from "react";
import CaseStudy from "./components/CaseStudy.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AskSignal from "./components/AskSignal.jsx";
import Copilot from "./components/Copilot.jsx";

export default function App() {
  const [view, setView] = useState("case");

  return (
    <>
      <nav className="topnav">
        <div className="brand">
          <div className="dot" />
          <div className="brand-text">
            Signal
            <span className="sub">Product Analytics &amp; Retention Intelligence</span>
          </div>
        </div>
        <div className="nav-right">
          <div className="toggle">
            <button className={view === "case" ? "active" : ""} onClick={() => setView("case")}>
              Case Study
            </button>
            <button className={view === "dash" ? "active" : ""} onClick={() => setView("dash")}>
              Dashboard
            </button>
            <button className={view === "copilot" ? "active" : ""} onClick={() => setView("copilot")}>
              Copilot
            </button>
            <button className={view === "ask" ? "active" : ""} onClick={() => setView("ask")}>
              Ask Signal
            </button>
          </div>
          <a className="gh-link" href="https://github.com/KanishkaSingh19" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </nav>

      {view === "case" && <CaseStudy onExplore={() => setView("dash")} />}
      {view === "dash" && <Dashboard />}
      {view === "copilot" && <Copilot />}
      {view === "ask" && <AskSignal />}
    </>
  );
}
