'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Zap, Syringe, History as HistoryIcon, Trash2, ChevronRight, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCases, deleteCase as deleteCaseFromStorage, getCaseById } from '@/lib/db';

export default function CaseHistory() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);

  const fetchCases = async () => {
    try {
      const data = getCases();
      setCases(data);
    } catch (err) {
      console.error("Failed to fetch cases", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const deleteCase = async (id: string) => {
    if (!confirm("Are you sure you want to delete this case history?")) return;
    try {
      deleteCaseFromStorage(id);
      setCases(cases.filter(c => c.id !== id));
      if (selectedCase?.id === id) setSelectedCase(null);
    } catch (err) {
      console.error("Failed to delete case", err);
    }
  };

  const viewDetails = async (id: string) => {
    setLoading(true);
    try {
      const data = getCaseById(id);
      setSelectedCase(data);
    } catch (err) {
      console.error("Failed to fetch case details", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" className="border-slate-700 text-slate-400">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tool
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <HistoryIcon className="h-8 w-8 text-blue-500" /> Case History
            </h1>
          </div>
          <Badge variant="outline" className="text-slate-500">
            {cases.length} Total Sessions
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of cases */}
          <div className="lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2">
            {loading && cases.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Loading cases...</div>
            ) : cases.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                No saved cases yet.
              </div>
            ) : (
              cases.map((c) => (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-all hover:border-blue-500/50 ${selectedCase?.id === c.id ? 'border-blue-500 bg-blue-500/10' : 'bg-slate-900/50 border-slate-800'}`}
                  onClick={() => viewDetails(c.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">{c.scenarioName || 'Clinical Case'}</span>
                        <span className="text-slate-500 text-[10px]">{new Date(c.startTime).toLocaleString()}</span>
                      </div>
                      {c.isMegacode && (
                        <Badge variant={c.passed ? "default" : "destructive"} className="text-[10px] px-1 h-5">
                          {c.passed ? "PASS" : "FAIL"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(c.duration)}</span>
                      <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {c.shocks}</span>
                      <span className="flex items-center gap-1"><Syringe className="h-3 w-3" /> {c.epinephrine}mg</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Case Details */}
          <div className="lg:col-span-2">
            {selectedCase ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                {/* Header Summary */}
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                  <div className={`h-2 w-full ${selectedCase.isMegacode ? (selectedCase.passed ? 'bg-green-500' : 'bg-red-500') : 'bg-blue-500'}`} />
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-2xl text-white">{selectedCase.scenarioName || 'Clinical Resuscitation'}</CardTitle>
                        <CardDescription className="text-slate-400">
                          {new Date(selectedCase.startTime).toLocaleString()} • {selectedCase.isMegacode ? 'Megacode Evaluation' : 'Practice Case'}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500" onClick={() => deleteCase(selectedCase.id)}>
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Total Duration</p>
                        <p className="text-xl font-bold text-white">{formatTime(selectedCase.duration)}</p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Final Outcome</p>
                        <p className={`text-xl font-bold ${selectedCase.roscAchieved ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedCase.roscAchieved ? 'ROSC' : 'No ROSC'}
                        </p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Epinephrine</p>
                        <p className="text-xl font-bold text-white">{selectedCase.epinephrine} mg</p>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Evaluation Score</p>
                        <p className="text-xl font-bold text-blue-400">{selectedCase.score !== null ? `${selectedCase.score}%` : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Evaluation (if Megacode) */}
                {selectedCase.isMegacode && (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">Performance Evaluation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedCase.criticalFailures && JSON.parse(selectedCase.criticalFailures).length > 0 && (
                        <div className="bg-red-950/40 p-3 rounded-lg border border-red-500/50">
                          <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4" /> Critical Failures
                          </h4>
                          <ul className="list-disc list-inside text-red-200 text-sm space-y-1">
                            {JSON.parse(selectedCase.criticalFailures).map((fail: string, i: number) => <li key={i}>{fail}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700">
                        <h4 className="text-slate-200 font-bold mb-2">Performance Feedback</h4>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                          {selectedCase.feedback && JSON.parse(selectedCase.feedback).map((item: string, i: number) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timeline */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-white">Event Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedCase.events?.map((e: any) => (
                        <div key={e.id} className="flex gap-4 p-2 rounded bg-slate-800/30 text-sm">
                          <span className="text-slate-500 font-mono w-16 shrink-0">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          <Badge variant="outline" className="h-5 text-[10px] border-slate-700 text-slate-400 uppercase">{e.type}</Badge>
                          <span className="text-white">{e.note}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 py-24">
                <FileText className="h-16 w-16 opacity-20" />
                <p>Select a case from the list to view the full resuscitation timeline and evaluation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
