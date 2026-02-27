/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  LayoutDashboard, 
  Briefcase, 
  Target, 
  ShieldCheck, 
  BarChart3, 
  Globe2, 
  GraduationCap,
  ChevronRight,
  Layers,
  Settings2,
  Users,
  FileText,
  Activity,
  Trophy,
  Workflow,
  ClipboardCheck,
  TrendingUp,
  Gavel,
  PieChart,
  Cpu,
  Network,
  Clock,
  Bot,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Database,
  MessageSquare,
  History
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { CANDIDATE_DATA } from './data';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AssistantView = ({ endpoint }: { endpoint: string }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      
      const fetchPortfolioTool = {
        name: "fetch_portfolio_initiative_data",
        description: "Retrieve initiative-level portfolio data from sample SQLite Decision Mart for evaluation by funding algorithm.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      };

      const persistDecisionTool = {
        name: "persist_board_decision",
        description: "Persist Board-level funding decisions into Portfolio Decision Ledger.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            decision_id: { type: Type.STRING },
            initiative_id: { type: Type.STRING },
            composite_score: { type: Type.NUMBER },
            decision_outcome: { type: Type.STRING },
            board_rationale: { type: Type.STRING }
          },
          required: [
            "decision_id",
            "initiative_id",
            "composite_score",
            "decision_outcome",
            "board_rationale"
          ]
        }
      };

      const fetchDecisionsTool = {
        name: "fetch_board_decisions",
        description: "Retrieve all previously recorded Board-level funding decisions from the ledger.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      };

      let response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [...messages, { role: 'user', content: userMessage }].map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: "You are a TMO Portfolio Assistant. You have access to the portfolio database and a decision ledger. Use tools to fetch data or persist decisions as requested.",
          tools: [{ functionDeclarations: [fetchPortfolioTool, persistDecisionTool, fetchDecisionsTool] }]
        }
      });

      // Handle Function Calls
      if (response.functionCalls) {
        const call = response.functionCalls[0];
        let toolData;

        if (call.name === "fetch_portfolio_initiative_data") {
          const dbResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(call.args)
          });
          toolData = await dbResponse.json();
        } else if (call.name === "persist_board_decision") {
          const writeEndpoint = endpoint.replace('/queryPortfolio', '/writeBoardDecision');
          const dbResponse = await fetch(writeEndpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(call.args)
          });
          toolData = await dbResponse.json();
        } else if (call.name === "fetch_board_decisions") {
          const fetchDecisionsEndpoint = endpoint.replace('/queryPortfolio', '/getBoardDecisions');
          const dbResponse = await fetch(fetchDecisionsEndpoint, {
            method: 'GET',
            headers: { 
              'ngrok-skip-browser-warning': 'true'
            }
          });
          toolData = await dbResponse.json();
        }

        if (toolData) {
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
              ...messages, 
              { role: 'user', content: userMessage },
              { role: 'model', parts: [{ functionCall: call }] },
              { role: 'user', parts: [{ functionResponse: { name: call.name, response: { data: toolData } } }] }
            ] as any,
            config: {
              systemInstruction: "You are a TMO Portfolio Assistant. Use the provided data to answer the user's question accurately.",
            }
          });
        }
      }

      const assistantText = response.text || "I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
        <div className="p-2 bg-zinc-900 rounded-lg text-white">
          <Bot size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Portfolio AI Assistant</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Connected to Decision Mart</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <MessageSquare size={48} className="text-zinc-300" />
            <div className="max-w-xs">
              <p className="text-sm font-bold text-zinc-900">How can I help you today?</p>
              <p className="text-xs text-zinc-500 mt-1">Ask me about project benefits, risk severities, or program alignments.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex",
            m.role === 'user' ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm",
              m.role === 'user' 
                ? "bg-zinc-900 text-white rounded-tr-none" 
                : "bg-zinc-100 text-zinc-800 rounded-tl-none"
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-500 font-medium">Assistant is thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
        <div className="relative">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about the portfolio..."
            className="w-full p-4 pr-12 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const BoardDecisionsView = ({ endpoint }: { endpoint: string }) => {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchDecisionsEndpoint = endpoint.replace('/queryPortfolio', '/getBoardDecisions');
      const response = await fetch(fetchDecisionsEndpoint, {
        method: 'GET',
        headers: { 
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch board decisions');
      const result = await response.json();
      setDecisions(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, [endpoint]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Board Decision Ledger</h2>
          <p className="text-sm text-zinc-500 mt-1">Audit trail of all persisted funding decisions</p>
        </div>
        <button 
          onClick={fetchDecisions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
          Refresh Ledger
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Decision ID</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Initiative ID</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Score</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Outcome</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Rationale</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {decisions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400 text-sm italic">
                    No decisions recorded in the ledger yet.
                  </td>
                </tr>
              )}
              {decisions.map((d, i) => (
                <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="p-4 text-sm font-mono text-zinc-600">{d.decision_id}</td>
                  <td className="p-4 text-sm font-medium text-zinc-900">{d.initiative_id}</td>
                  <td className="p-4 text-sm text-zinc-600">
                    <span className="px-2 py-1 bg-zinc-100 rounded text-xs font-bold">
                      {d.composite_score}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      d.decision_outcome?.toLowerCase() === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {d.decision_outcome}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-zinc-500 max-w-xs truncate" title={d.board_rationale}>
                    {d.board_rationale}
                  </td>
                  <td className="p-4 text-xs text-zinc-400">
                    {new Date(d.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PortfolioDataView = ({ endpoint, onEndpointChange }: { endpoint: string, onEndpointChange: (val: string) => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingEndpoint, setIsEditingEndpoint] = useState(false);
  const [tempEndpoint, setTempEndpoint] = useState(endpoint);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch portfolio data. Ensure your ngrok tunnel is active and the endpoint is correct.');
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [endpoint]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Portfolio Decision Mart</h2>
          <div className="flex items-center gap-2 mt-1">
            {isEditingEndpoint ? (
              <div className="flex items-center gap-2">
                <input 
                  value={tempEndpoint}
                  onChange={(e) => setTempEndpoint(e.target.value)}
                  className="text-xs p-1 border border-zinc-200 rounded bg-white w-64"
                />
                <button 
                  onClick={() => {
                    onEndpointChange(tempEndpoint);
                    setIsEditingEndpoint(false);
                  }}
                  className="text-[10px] font-bold text-emerald-600 uppercase"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-500">Source: <code className="text-xs bg-zinc-100 px-1 rounded">{endpoint}</code></p>
                <button 
                  onClick={() => setIsEditingEndpoint(true)}
                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 uppercase"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
        <button 
          onClick={fetchPortfolio}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Project ID</th>
                <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Project Name</th>
                <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Program</th>
                <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Planned Benefit</th>
                <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Risk Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-zinc-100 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : data.length > 0 ? (
                data.map((row) => (
                  <tr key={row.project_id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 text-sm font-mono text-zinc-500">#{row.project_id}</td>
                    <td className="p-4 text-sm font-bold text-zinc-900">{row.project_name}</td>
                    <td className="p-4 text-sm text-zinc-600">{row.program_name}</td>
                    <td className="p-4 text-sm font-medium text-emerald-600">
                      ${row.planned_benefit_value.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                        row.risk_severity === 'High' ? "bg-red-100 text-red-700" :
                        row.risk_severity === 'Medium' ? "bg-amber-100 text-amber-700" :
                        "bg-emerald-100 text-emerald-700"
                      )}>
                        {row.risk_severity}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500 text-sm">No portfolio data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const SimulationView = () => {
  const [initiative, setInitiative] = useState({
    initiative_name: '',
    strategic_objective_alignment_description: '',
    expected_financial_benefit: '',
    expected_non_financial_benefit: '',
    delivery_risk_assessment: '',
    cross_program_dependencies: '',
    resource_capacity_impact: '',
    regulatory_or_compliance_impact: '',
    timeline_estimate: '',
    investment_size_estimate: ''
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInitiative(prev => ({ ...prev, [name]: value }));
  };

  const runSimulation = async () => {
    if (!initiative.initiative_name) {
      setError("Initiative name is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    
    console.log("Starting Board Simulation for:", initiative.initiative_name);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please ensure it is set in the environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: `Evaluate this transformation initiative based on the provided details: ${JSON.stringify(initiative)}`,
        config: {
          systemInstruction: `
            ROLE: ${CANDIDATE_DATA.simulation_framework.system_role.role}
            MANDATE: ${CANDIDATE_DATA.simulation_framework.system_role.mandate}
            EVALUATION STANDARD: ${CANDIDATE_DATA.simulation_framework.system_role.evaluation_standard}
            
            FUNDING ALGORITHM WEIGHTS:
            ${JSON.stringify(CANDIDATE_DATA.simulation_framework.algorithm.weights)}
            
            DECISION THRESHOLDS:
            ${JSON.stringify(CANDIDATE_DATA.simulation_framework.thresholds)}
            
            INSTRUCTIONS:
            1. Analyze the initiative details objectively.
            2. Score each of the 6 criteria from 1-5 (1=Poor, 5=Excellent).
            3. Calculate the weighted composite score using the provided weights.
            4. Determine the decision outcome based on the thresholds.
            5. Provide a professional board rationale and executive recommendations.
            6. Return ONLY a valid JSON object matching the schema.
          `,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              initiative_name: { type: Type.STRING },
              scoring_breakdown: {
                type: Type.OBJECT,
                properties: {
                  strategic_alignment_score: { type: Type.NUMBER },
                  expected_benefit_value_score: { type: Type.NUMBER },
                  delivery_risk_score: { type: Type.NUMBER },
                  dependency_complexity_score: { type: Type.NUMBER },
                  capacity_availability_score: { type: Type.NUMBER },
                  regulatory_impact_score: { type: Type.NUMBER }
                },
                required: [
                  "strategic_alignment_score", 
                  "expected_benefit_value_score", 
                  "delivery_risk_score", 
                  "dependency_complexity_score", 
                  "capacity_availability_score", 
                  "regulatory_impact_score"
                ]
              },
              weighted_composite_score: { type: Type.NUMBER },
              decision_outcome: { type: Type.STRING },
              board_rationale_summary: { type: Type.STRING },
              identified_conditions_or_risk_mitigations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              executive_action_recommendation: { type: Type.STRING }
            },
            required: [
              "initiative_name", 
              "scoring_breakdown", 
              "weighted_composite_score", 
              "decision_outcome", 
              "board_rationale_summary", 
              "executive_action_recommendation"
            ]
          }
        }
      });

      const text = response.text;
      console.log("AI Response received:", text);
      
      if (text) {
        const parsedResult = JSON.parse(text);
        setResult(parsedResult);
      } else {
        throw new Error("Empty response from simulation engine.");
      }
    } catch (err: any) {
      console.error("Simulation Error:", err);
      setError(err.message || "Simulation engine error. Please check your inputs and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
              <Bot size={24} className="text-zinc-400" />
            </div>
            <h2 className="text-2xl font-bold">Investment Board Simulation</h2>
          </div>
          <p className="text-zinc-400 max-w-2xl">AI-powered governance engine simulating board-level funding decisions based on weighted strategic criteria.</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Initiative Details" subtitle="Input transformation parameters for evaluation">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Initiative Name</label>
              <input 
                name="initiative_name"
                value={initiative.initiative_name}
                onChange={handleInputChange}
                placeholder="e.g. Enterprise Cloud Migration Phase 2"
                className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Investment Size</label>
                <input 
                  name="investment_size_estimate"
                  value={initiative.investment_size_estimate}
                  onChange={handleInputChange}
                  placeholder="e.g. €2.5M"
                  className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Timeline</label>
                <input 
                  name="timeline_estimate"
                  value={initiative.timeline_estimate}
                  onChange={handleInputChange}
                  placeholder="e.g. 18 Months"
                  className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Strategic Alignment</label>
              <textarea 
                name="strategic_objective_alignment_description"
                value={initiative.strategic_objective_alignment_description}
                onChange={handleInputChange}
                placeholder="How does this align with enterprise OKRs?"
                rows={2}
                className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Expected Benefits</label>
              <textarea 
                name="expected_financial_benefit"
                value={initiative.expected_financial_benefit}
                onChange={handleInputChange}
                placeholder="Financial and non-financial value..."
                rows={2}
                className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Risk & Dependencies</label>
              <textarea 
                name="delivery_risk_assessment"
                value={initiative.delivery_risk_assessment}
                onChange={handleInputChange}
                placeholder="Key risks and cross-program dependencies..."
                rows={2}
                className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm resize-none"
              />
            </div>
            <button 
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Simulating Board Review...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Submit for Board Evaluation
                </>
              )}
            </button>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-8">
          {!result && !loading && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <Bot size={32} className="text-zinc-300" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Awaiting Submission</h3>
              <p className="text-sm text-zinc-500 max-w-xs mt-2">Enter initiative details to trigger the AI-powered Investment Board simulation.</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-100 border-t-zinc-900 animate-spin" />
                <Bot size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-900" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mt-6">Board in Session</h3>
              <p className="text-sm text-zinc-500 max-w-xs mt-2">Evaluating strategic alignment, benefit value, and delivery risk profiles...</p>
            </div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className={cn(
                "p-6 rounded-2xl border flex items-center justify-between",
                result.decision_outcome === 'Approve' ? "bg-emerald-50 border-emerald-100" :
                result.decision_outcome === 'Approve with conditions' ? "bg-amber-50 border-amber-100" :
                "bg-red-50 border-red-100"
              )}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Board Decision</p>
                  <h3 className={cn(
                    "text-2xl font-bold mt-1",
                    result.decision_outcome === 'Approve' ? "text-emerald-700" :
                    result.decision_outcome === 'Approve with conditions' ? "text-amber-700" :
                    "text-red-700"
                  )}>{result.decision_outcome}</h3>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  result.decision_outcome === 'Approve' ? "bg-emerald-500 text-white" :
                  result.decision_outcome === 'Approve with conditions' ? "bg-amber-500 text-white" :
                  "bg-red-500 text-white"
                )}>
                  {result.decision_outcome === 'Approve' ? <CheckCircle2 size={24} /> :
                   result.decision_outcome === 'Approve with conditions' ? <Info size={24} /> :
                   <XCircle size={24} />}
                </div>
              </div>

              <Card title="Scoring Breakdown" icon={BarChart3}>
                <div className="space-y-4">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Composite Score</p>
                    <p className="text-3xl font-bold text-zinc-900">{result.weighted_composite_score.toFixed(2)}</p>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(result.scoring_breakdown).map(([key, score]: [string, any]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          <span>{key.replace(/_/g, ' ').replace('score', '')}</span>
                          <span>{score}/5</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(score / 5) * 100}%` }}
                            className={cn(
                              "h-full rounded-full",
                              score >= 4 ? "bg-emerald-500" : score >= 3 ? "bg-amber-500" : "bg-red-500"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title="Board Rationale" icon={FileText}>
                <p className="text-sm text-zinc-700 leading-relaxed">{result.board_rationale_summary}</p>
                {result.identified_conditions_or_risk_mitigations?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Conditions & Mitigations</p>
                    <div className="space-y-2">
                      {result.identified_conditions_or_risk_mitigations.map((item: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                          <div className="w-1 h-1 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <div className="p-4 rounded-xl bg-zinc-900 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Executive Action</p>
                <p className="text-sm font-medium mt-1">{result.executive_action_recommendation}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Post-Approval Monitoring" icon={Activity} className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Trigger Conditions</p>
              <div className="space-y-2">
                {CANDIDATE_DATA.simulation_framework.monitoring.triggers.map((trigger, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs font-medium text-zinc-700">
                    <AlertCircle size={14} className="text-amber-500" />
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Board Actions</p>
              <div className="flex flex-wrap gap-2">
                {["Continue", "Corrective Action", "Rebaseline", "Suspend", "Terminate"].map((action, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    {action}
                  </span>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Review Frequency</p>
                <p className="text-sm font-bold text-zinc-900">{CANDIDATE_DATA.simulation_framework.monitoring.frequency}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Governance Standards" icon={ShieldCheck}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Evaluation Standard</p>
              <p className="text-xs font-medium text-emerald-900 leading-relaxed">{CANDIDATE_DATA.simulation_framework.system_role.evaluation_standard}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Decision Thresholds</p>
              {Object.entries(CANDIDATE_DATA.simulation_framework.thresholds).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-bold text-zinc-900">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-all rounded-lg group",
      active 
        ? "bg-zinc-900 text-white shadow-lg" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    )}
  >
    <Icon size={18} className={cn(active ? "text-white" : "text-zinc-400 group-hover:text-zinc-900")} />
    <span>{label}</span>
    {active && (
      <motion.div 
        layoutId="active-pill"
        className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
      />
    )}
  </button>
);

const Card = ({ children, title, subtitle, icon: Icon, className }: { children: React.ReactNode, title?: string, subtitle?: string, icon?: any, className?: string, key?: string | number }) => (
  <div className={cn("bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm", className)}>
    {(title || subtitle || Icon) && (
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
        <div>
          {title && <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">{title}</h3>}
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon size={18} className="text-zinc-400" />}
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, trend }: { label: string, value: string | number, icon: any, trend?: string }) => (
  <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <h4 className="text-2xl font-bold text-zinc-900 mt-1">{value}</h4>
      {trend && <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>}
    </div>
    <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
      <Icon size={20} className="text-zinc-600" />
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('assistant');
  const [portfolioEndpoint, setPortfolioEndpoint] = useState('https://hyperspatial-drossy-juelz.ngrok-free.dev/queryPortfolio');
  const data = CANDIDATE_DATA;

  const radarData = useMemo(() => {
    return Object.entries(data.functional_specialisation).map(([key, value]) => ({
      subject: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      A: value ? 100 : 0,
      fullMark: 100,
    }));
  }, [data]);

  const experienceData = useMemo(() => {
    return data.organisational_roles.map((role, index) => ({
      name: role.organisation,
      years: 25 - (index * 3), // Mocking distribution for visualization
      role: role.role
    })).reverse();
  }, [data]);

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">TMO Hub</h1>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Enterprise Portfolio</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarItem 
            icon={Briefcase} 
            label="Experience" 
            active={activeTab === 'experience'} 
            onClick={() => setActiveTab('experience')} 
          />
          <SidebarItem 
            icon={Target} 
            label="Specialisations" 
            active={activeTab === 'specialisations'} 
            onClick={() => setActiveTab('specialisations')} 
          />
          <SidebarItem 
            icon={ShieldCheck} 
            label="Governance" 
            active={activeTab === 'governance'} 
            onClick={() => setActiveTab('governance')} 
          />
          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Strategic Tools</p>
          </div>
          <SidebarItem 
            icon={Activity} 
            label="RAID Management" 
            active={activeTab === 'raid'} 
            onClick={() => setActiveTab('raid')} 
          />
          <SidebarItem 
            icon={Workflow} 
            label="Operating Model" 
            active={activeTab === 'operating-model'} 
            onClick={() => setActiveTab('operating-model')} 
          />
          <SidebarItem 
            icon={Trophy} 
            label="Maturity Matrix" 
            active={activeTab === 'maturity'} 
            onClick={() => setActiveTab('maturity')} 
          />
          <SidebarItem 
            icon={TrendingUp} 
            label="Benefits Maturity" 
            active={activeTab === 'benefits-maturity'} 
            onClick={() => setActiveTab('benefits-maturity')} 
          />
          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Board Framework</p>
          </div>
          <SidebarItem 
            icon={Gavel} 
            label="Board Charter" 
            active={activeTab === 'charter'} 
            onClick={() => setActiveTab('charter')} 
          />
          <SidebarItem 
            icon={PieChart} 
            label="KPI Taxonomy" 
            active={activeTab === 'kpis'} 
            onClick={() => setActiveTab('kpis')} 
          />
          <SidebarItem 
            icon={Cpu} 
            label="Funding Algorithm" 
            active={activeTab === 'algorithm'} 
            onClick={() => setActiveTab('algorithm')} 
          />
          <SidebarItem 
            icon={Network} 
            label="RACI Model" 
            active={activeTab === 'raci'} 
            onClick={() => setActiveTab('raci')} 
          />
          <SidebarItem 
            icon={Bot} 
            label="Board Simulation" 
            active={activeTab === 'simulation'} 
            onClick={() => setActiveTab('simulation')} 
          />
          <SidebarItem 
            icon={Database} 
            label="Portfolio Data" 
            active={activeTab === 'portfolio-data'} 
            onClick={() => setActiveTab('portfolio-data')} 
          />
          <SidebarItem 
            icon={MessageSquare} 
            label="AI Assistant" 
            active={activeTab === 'assistant'} 
            onClick={() => setActiveTab('assistant')} 
          />
          <SidebarItem 
            icon={History} 
            label="Decision Ledger" 
            active={activeTab === 'decisions'} 
            onClick={() => setActiveTab('decisions')} 
          />
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden">
              <img 
                src="https://picsum.photos/seed/stephan/100/100" 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{data.candidate_profile.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">Transformation Lead</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-zinc-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Portfolio</span>
            <ChevronRight size={14} />
            <span className="text-zinc-900 font-medium capitalize">{activeTab.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-xs font-medium text-zinc-600 border border-zinc-200">
              <Globe2 size={14} />
              <span>{Object.keys(data.candidate_profile.languages).length} Languages</span>
            </div>
            <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
              <Settings2 size={20} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="Experience" value={`${data.candidate_profile.experience_years} Years`} icon={Briefcase} trend="+25 years expertise" />
                  <StatCard label="Specialisations" value={Object.keys(data.functional_specialisation).length} icon={Target} />
                  <StatCard label="Sectors" value={data.sector_experience.length} icon={ShieldCheck} />
                  <StatCard label="Roles Held" value={data.organisational_roles.length} icon={Users} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card title="Strategic Competency" subtitle="Functional specialisation distribution" className="lg:col-span-2">
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#e4e4e7" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10 }} />
                          <Radar
                            name="Stephan"
                            dataKey="A"
                            stroke="#18181b"
                            fill="#18181b"
                            fillOpacity={0.1}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Core Focus Areas" subtitle="Transformation priorities">
                    <div className="space-y-4">
                      {data.transformation_focus_areas.map((area, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100 group hover:border-zinc-300 transition-all">
                          <div className="w-6 h-6 rounded bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-400 group-hover:text-zinc-900">
                            0{i + 1}
                          </div>
                          <span className="text-sm font-medium text-zinc-700">{area}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="Education & Background" icon={GraduationCap}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-zinc-900 rounded-xl text-white">
                        <GraduationCap size={24} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-zinc-900">{data.candidate_profile.education}</p>
                        <p className="text-sm text-zinc-500 mt-1">Advanced academic foundation in technical and business domains.</p>
                      </div>
                    </div>
                  </Card>
                  <Card title="Delivery Environment" subtitle="Operational context expertise">
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(data.delivery_environment).map(([key, value]) => (
                        <div key={key} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-semibold text-zinc-900 mt-1">{value ? 'Expert' : 'Familiar'}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'experience' && (
              <motion.div
                key="experience"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <Card title="Career Timeline" subtitle="Organisational impact over 25 years">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={experienceData}>
                        <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#f4f4f5' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="years" radius={[4, 4, 0, 0]}>
                          {experienceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === experienceData.length - 1 ? '#18181b' : '#d4d4d8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-2">Professional History</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.organisational_roles.map((role, i) => (
                      <div key={i} className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400">
                          <Briefcase size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{role.organisation}</p>
                          <h4 className="text-lg font-bold text-zinc-900 mt-1">{role.role}</h4>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                              role.period === 'Current' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                            )}>
                              {role.period}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'specialisations' && (
              <motion.div
                key="specialisations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {Object.entries(data.functional_specialisation).map(([key, value]) => (
                  <Card key={key} className="group hover:border-zinc-900 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                    <h4 className="font-bold text-zinc-900 capitalize">{key.replace(/_/g, ' ')}</h4>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      Deep expertise in {key.replace(/_/g, ' ')} within regulated enterprise environments.
                    </p>
                  </Card>
                ))}
              </motion.div>
            )}

            {activeTab === 'governance' && (
              <motion.div
                key="governance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card title="Governance Framework" subtitle="Strategic oversight model">
                      <div className="space-y-6">
                        <div className="flex gap-4">
                          <div className="w-1 bg-zinc-900 rounded-full" />
                          <div>
                            <h5 className="font-bold text-zinc-900">Transformation Portfolio Structuring</h5>
                            <p className="text-sm text-zinc-500 mt-1">Organising complex initiatives into manageable portfolios aligned with corporate strategy.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-1 bg-zinc-400 rounded-full" />
                          <div>
                            <h5 className="font-bold text-zinc-900">Initiative Prioritisation</h5>
                            <p className="text-sm text-zinc-500 mt-1">Data-driven decision making to ensure resources are allocated to high-impact projects.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-1 bg-zinc-200 rounded-full" />
                          <div>
                            <h5 className="font-bold text-zinc-900">Benefits Realisation Tracking</h5>
                            <p className="text-sm text-zinc-500 mt-1">Continuous monitoring of outcomes against initial business cases and OKRs.</p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card title="Tooling Ecosystem" subtitle="Enterprise software proficiency">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(data.tooling_experience).map(([tool, desc]) => (
                          <div key={tool} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center">
                                <BarChart3 size={12} className="text-white" />
                              </div>
                              <span className="font-bold text-sm">{tool}</span>
                            </div>
                            <p className="text-xs text-zinc-500">{Array.isArray(desc) ? desc.join(', ') : desc}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card title="Discussion Topics" subtitle="Strategic focus areas">
                      <div className="space-y-3">
                        {data.discussion_topics.map((topic, i) => (
                          <div key={i} className="p-3 rounded-lg border border-zinc-100 bg-white text-sm font-medium text-zinc-700 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                            {topic}
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card title="Sector Expertise" subtitle="Industry vertical knowledge">
                      <div className="flex flex-wrap gap-2">
                        {data.sector_experience.map((sector, i) => (
                          <span key={i} className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-zinc-200">
                            {sector}
                          </span>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'operating-model' && (
              <motion.div
                key="operating-model"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl overflow-hidden relative">
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold">TMO Operating Model</h2>
                    <p className="text-zinc-400 mt-2 max-w-2xl">{data.governance_pack.tmo_operating_model.purpose}</p>
                    <div className="flex flex-wrap gap-2 mt-6">
                      {data.governance_pack.tmo_operating_model.design_principles.map((principle, i) => (
                        <span key={i} className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                          {principle}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(data.governance_pack.tmo_operating_model.operating_layers).map(([key, layer]: [string, any]) => (
                    <Card key={key} title={key.replace(/_/g, ' ')} icon={Layers}>
                      <div className="space-y-4">
                        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scope</p>
                          <p className="text-sm font-medium text-zinc-900 mt-1">{layer.scope}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Responsibilities</p>
                          <ul className="space-y-2">
                            {layer.responsibilities.map((resp: string, i: number) => (
                              <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                                {resp}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {layer.decision_forums && (
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Decision Forums</p>
                            <div className="flex flex-wrap gap-2">
                              {layer.decision_forums.map((forum: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-[10px] font-bold border border-zinc-200">
                                  {forum}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {layer.tooling && (
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Tooling</p>
                            <div className="flex items-center gap-2">
                              {layer.tooling.map((tool: string, i: number) => (
                                <span key={i} className="text-xs font-medium text-zinc-900 flex items-center gap-1">
                                  <BarChart3 size={12} className="text-zinc-400" />
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="Core Capabilities" subtitle="Strategic TMO functions">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.governance_pack.tmo_operating_model.core_capabilities.map((cap, i) => (
                        <div key={i} className="p-3 rounded-xl border border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-sm">
                            <ClipboardCheck size={16} />
                          </div>
                          <span className="text-xs font-semibold text-zinc-700">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Success Metrics" subtitle="KPIs for governance effectiveness">
                    <div className="space-y-3">
                      {data.governance_pack.tmo_operating_model.success_metrics.map((metric, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                          <span className="text-xs font-medium text-zinc-700">{metric}</span>
                          <div className="w-12 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${80 - i * 10}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'maturity' && (
              <motion.div
                key="maturity"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Capability Maturity Matrix</h2>
                    <p className="text-zinc-500 text-sm mt-1">Enterprise Portfolio Governance Assessment</p>
                  </div>
                  <div className="flex gap-2">
                    {data.governance_pack.capability_matrix.maturity_levels.map((level, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={cn(
                          "w-8 h-1.5 rounded-full",
                          i < 3 ? "bg-emerald-500" : "bg-zinc-200"
                        )} />
                        <span className="text-[8px] font-bold text-zinc-400 uppercase">{level.split(' - ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-1/4">Capability Domain</th>
                        <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-1/4">Level 1 (Ad-hoc)</th>
                        <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-1/4">Level 3 (Defined)</th>
                        <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-1/4">Level 5 (Optimised)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {data.governance_pack.capability_matrix.capability_domains.map((domain, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                                <ShieldCheck size={16} />
                              </div>
                              <span className="font-bold text-sm text-zinc-900">{domain.domain}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <p className="text-xs text-zinc-500 leading-relaxed">{domain.level_1}</p>
                          </td>
                          <td className="p-6">
                            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                              <p className="text-xs text-zinc-700 font-medium leading-relaxed">{domain.level_3}</p>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="p-3 rounded-lg bg-zinc-900 text-white shadow-lg">
                              <p className="text-xs font-medium leading-relaxed opacity-90">{domain.level_5}</p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'benefits-maturity' && (
              <motion.div
                key="benefits-maturity"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-emerald-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                        <TrendingUp size={24} className="text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-bold">Benefits Realisation Maturity</h2>
                    </div>
                    <p className="text-emerald-100/70 max-w-2xl">Strategic assessment of enterprise value tracking and accountability mechanisms.</p>
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-800/50 rounded-full border border-emerald-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Target Maturity</span>
                      <span className="text-sm font-bold">{data.governance_pack.benefits_maturity.target_maturity}</span>
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-800 rounded-full -mb-48 -mr-48 blur-3xl opacity-30" />
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {data.governance_pack.benefits_maturity.assessment_dimensions.map((dim, i) => (
                    <Card key={i} title={dim.dimension} subtitle={dim.description} icon={TrendingUp}>
                      <div className="relative mt-4">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 -translate-y-1/2" />
                        <div className="grid grid-cols-5 gap-4 relative z-10">
                          {dim.maturity_progression.map((step, j) => (
                            <div key={j} className="flex flex-col items-center group">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all mb-3",
                                j < 4 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white border-2 border-zinc-200 text-zinc-400"
                              )}>
                                {j + 1}
                              </div>
                              <p className={cn(
                                "text-[10px] text-center font-medium leading-tight px-2 transition-colors",
                                j < 4 ? "text-zinc-900" : "text-zinc-400"
                              )}>
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'charter' && (
              <motion.div
                key="charter"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                        <Gavel size={24} className="text-zinc-400" />
                      </div>
                      <h2 className="text-2xl font-bold">Board Governance Charter</h2>
                    </div>
                    <p className="text-zinc-400 max-w-2xl leading-relaxed">{data.board_framework.charter.purpose}</p>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="Governance Objectives" icon={Target}>
                    <div className="space-y-4">
                      {data.board_framework.charter.objectives.map((obj, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                          <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <span className="text-sm text-zinc-700">{obj}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Governance Principles" icon={ShieldCheck}>
                    <div className="space-y-3">
                      {data.board_framework.charter.principles.map((principle, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-white shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-medium text-zinc-700">{principle}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card title="Decision Authorities" className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(data.board_framework.charter.decision_authorities).map(([key, authorities]: [string, any]) => (
                        <div key={key} className="space-y-3">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                          <div className="space-y-2">
                            {authorities.map((auth: string, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs font-medium text-zinc-700">
                                {auth}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Review Cadence" icon={Clock}>
                    <div className="space-y-4">
                      {Object.entries(data.board_framework.charter.review_cadence).map(([key, cadence]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50/50">
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-bold text-zinc-900">{cadence}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'kpis' && (
              <motion.div
                key="kpis"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Transformation KPI Taxonomy</h2>
                    <p className="text-zinc-500 text-sm mt-1">Standardised metrics for portfolio performance tracking</p>
                  </div>
                  <div className="p-2 bg-zinc-100 rounded-lg">
                    <PieChart size={24} className="text-zinc-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.board_framework.kpi_taxonomy.map((domain, i) => (
                    <Card key={i} title={domain.domain} icon={BarChart3}>
                      <div className="space-y-2">
                        {domain.kpis.map((kpi, j) => (
                          <div key={j} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100 group hover:border-zinc-300 transition-all">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 group-hover:bg-zinc-900" />
                            <span className="text-xs font-medium text-zinc-700">{kpi}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'algorithm' && (
              <motion.div
                key="algorithm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                        <Cpu size={24} className="text-zinc-400" />
                      </div>
                      <h2 className="text-2xl font-bold">Strategic Funding Decision Algorithm</h2>
                    </div>
                    <p className="text-zinc-400 max-w-2xl">Weighted multi-criteria scoring model for objective investment governance.</p>
                  </div>
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-zinc-800 rounded-full -mb-48 -mr-48 blur-3xl opacity-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card title="Decision Inputs" className="lg:col-span-1">
                    <div className="space-y-3">
                      {data.board_framework.funding_algorithm.inputs.map((input, i) => (
                        <div key={i} className="p-3 rounded-lg border border-zinc-100 bg-zinc-50/50 text-xs font-medium text-zinc-700">
                          {input}
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Evaluation Model Weights" className="lg:col-span-2">
                    <div className="space-y-4">
                      {Object.entries(data.board_framework.funding_algorithm.evaluation_model.weights).map(([key, weight]: [string, any]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-bold text-zinc-900">{Math.round(weight * 100)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${weight * 100}%` }}
                              className="h-full bg-zinc-900 rounded-full" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card title="Decision Outcomes" icon={ClipboardCheck}>
                    <div className="flex flex-wrap gap-2">
                      {data.board_framework.funding_algorithm.outcomes.map((outcome, i) => (
                        <span key={i} className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border",
                          outcome === 'Approve' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          outcome === 'Reject' || outcome === 'Terminate' ? "bg-red-50 text-red-700 border-red-100" :
                          "bg-zinc-50 text-zinc-600 border-zinc-200"
                        )}>
                          {outcome}
                        </span>
                      ))}
                    </div>
                  </Card>
                  <Card title="Governance Usage" icon={Workflow}>
                    <div className="space-y-2">
                      {data.board_framework.funding_algorithm.usage.map((usage, i) => (
                        <div key={i} className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs font-medium text-zinc-700">
                          {usage}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'raci' && (
              <motion.div
                key="raci"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">TMO RACI Model</h2>
                    <p className="text-zinc-500 text-sm mt-1">Cross-functional accountability and responsibility mapping</p>
                  </div>
                  <div className="p-2 bg-zinc-100 rounded-lg">
                    <Network size={24} className="text-zinc-400" />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Activity</th>
                        {CANDIDATE_DATA.board_framework.raci.layers.map((layer: string, i: number) => (
                          <th key={i} className="p-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">{layer}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {CANDIDATE_DATA.board_framework.raci.mapping.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="p-6">
                            <span className="font-bold text-sm text-zinc-900">{row.activity}</span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                              row.executive === 'Accountable' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                            )}>{row.executive.charAt(0)}</span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                              row.portfolio === 'Accountable' ? "bg-zinc-900 text-white" : 
                              row.portfolio === 'Responsible' ? "bg-zinc-200 text-zinc-900" : "bg-zinc-100 text-zinc-500"
                            )}>{row.portfolio.charAt(0)}</span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                              row.delivery === 'Responsible' ? "bg-zinc-200 text-zinc-900" : "bg-zinc-100 text-zinc-500"
                            )}>{row.delivery.charAt(0)}</span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={cn(
                              "inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                              row.run === 'Accountable' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                            )}>{row.run.charAt(0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-6 justify-center">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="w-4 h-4 rounded bg-zinc-900 flex items-center justify-center text-white">A</span> Accountable
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="w-4 h-4 rounded bg-zinc-200 flex items-center justify-center text-zinc-900">R</span> Responsible
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="w-4 h-4 rounded bg-zinc-100 flex items-center justify-center text-zinc-500">C</span> Consulted
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      <span className="w-4 h-4 rounded bg-zinc-100 flex items-center justify-center text-zinc-500">I</span> Informed
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'simulation' && (
              <motion.div
                key="simulation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <SimulationView />
              </motion.div>
            )}

            {activeTab === 'portfolio-data' && (
              <motion.div
                key="portfolio-data"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <PortfolioDataView 
                  endpoint={portfolioEndpoint} 
                  onEndpointChange={setPortfolioEndpoint} 
                />
              </motion.div>
            )}

            {activeTab === 'assistant' && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <AssistantView endpoint={portfolioEndpoint} />
              </motion.div>
            )}

            {activeTab === 'decisions' && (
              <motion.div
                key="decisions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <BoardDecisionsView endpoint={portfolioEndpoint} />
              </motion.div>
            )}

            {activeTab === 'raid' && (
              <motion.div
                key="raid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="Active Risks" value="12" icon={Activity} trend="2 Critical" />
                  <StatCard label="Open Issues" value="8" icon={Activity} trend="3 High Priority" />
                  <StatCard label="Dependencies" value="24" icon={Layers} trend="Cross-Portfolio" />
                  <StatCard label="Decisions" value="5" icon={ShieldCheck} trend="Pending Board" />
                </div>
                
                <Card title="Portfolio RAID Aggregation" subtitle="Consolidated view of delivery health">
                  <div className="space-y-4">
                    {[
                      { type: 'Risk', title: 'Vendor Capacity Constraints', impact: 'High', status: 'Mitigating' },
                      { type: 'Issue', title: 'Regulatory Compliance Deadline Shift', impact: 'Critical', status: 'Escalated' },
                      { type: 'Dependency', title: 'Cloud Infrastructure Provisioning', impact: 'Medium', status: 'On Track' },
                      { type: 'Decision', title: 'Q3 Funding Reallocation', impact: 'High', status: 'Pending' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 bg-zinc-50/50">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                            item.type === 'Risk' ? "bg-amber-100 text-amber-700" :
                            item.type === 'Issue' ? "bg-red-100 text-red-700" :
                            item.type === 'Dependency' ? "bg-blue-100 text-blue-700" :
                            "bg-purple-100 text-purple-700"
                          )}>
                            {item.type}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Impact: {item.impact}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-zinc-600">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
