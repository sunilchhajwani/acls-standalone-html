'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Zap, Minus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DynamicECG } from '@/components/DynamicECG';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

type ECGType = 'sinus' | 'vf' | 'vt' | 'asystole' | 'bradycardia';

const ECG_CONFIG = {
  sinus: { bpm: 75, label: 'Normal Sinus Rhythm' },
  bradycardia: { bpm: 35, label: 'Symptomatic Bradycardia' },
  vt: { bpm: 160, label: 'Ventricular Tachycardia' },
  vf: { bpm: 0, label: 'Ventricular Fibrillation' },
  asystole: { bpm: 0, label: 'Asystole' },
};

export default function ECGDemo() {
  const [type, setType] = useState<ECGType>('sinus');
  const [speed, setSpeed] = useState(0.6);

  return (
    <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <Link to="/">
          <Button variant="outline" className="border-slate-700 text-slate-400">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tool
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-white uppercase tracking-widest">ECG Simulator Demo</h1>
        <div className="w-24" />
      </div>

      <Card className="w-full max-w-4xl bg-black border-4 border-slate-800 shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-900 bg-slate-900/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <CardTitle className="text-green-500 font-mono text-xl tracking-tighter">
                LEAD II • HR {type === 'sinus' ? '75' : type === 'bradycardia' ? '35' : type === 'vt' ? '165' : '0'}
              </CardTitle>
            </div>
            <span className="text-slate-500 font-mono text-xs hidden sm:inline">
              {(speed * 41.6).toFixed(1)} mm/s • 10mm/mV
            </span>
          </div>
          <Badge variant="outline" className="border-green-900 text-green-700 font-mono text-[10px]">
            REAL-TIME SVG RENDER
          </Badge>
        </CardHeader>

        <CardContent className="p-0 relative h-64 flex items-center bg-black/20">
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />

          <DynamicECG rhythm={type as any} speed={speed} height={200} />

          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded border border-green-900/50">
            <p className="text-green-500 font-mono text-sm font-bold uppercase">{ECG_CONFIG[type].label}</p>
          </div>
        </CardContent>
      </Card>

      {/* Speed Control UI */}
      <div className="w-full max-w-xl bg-slate-900/50 p-6 rounded-xl border border-slate-800 mt-8 space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-slate-300 font-bold">Monitor Sweep Speed</Label>
          <span className="text-blue-400 font-mono text-sm font-bold">{(speed * 41.6).toFixed(1)} mm/s</span>
        </div>
        <Slider
          value={[speed]}
          onValueChange={(val) => setSpeed(val[0])}
          min={0.2}
          max={1.5}
          step={0.1}
          className="py-4"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase">
          <span>12.5 mm/s (Slow)</span>
          <span>25 mm/s (Standard)</span>
          <span>50 mm/s (Fast)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 w-full max-w-4xl">
        <Button
          onClick={() => setType('sinus')}
          className={`h-16 ${type === 'sinus' ? 'bg-green-600 ring-2 ring-white' : 'bg-slate-800'}`}
        >
          <Activity className="mr-2 h-5 w-5" /> Normal Sinus
        </Button>
        <Button
          onClick={() => setType('bradycardia')}
          className={`h-16 ${type === 'bradycardia' ? 'bg-blue-600 ring-2 ring-white' : 'bg-slate-800'}`}
        >
          <Activity className="mr-2 h-5 w-5 rotate-180" /> Bradycardia
        </Button>
        <Button
          onClick={() => setType('vt')}
          className={`h-16 ${type === 'vt' ? 'bg-orange-600 ring-2 ring-white' : 'bg-slate-800'}`}
        >
          <Zap className="mr-2 h-5 w-5" /> VT
        </Button>
        <Button
          onClick={() => setType('vf')}
          className={`h-16 ${type === 'vf' ? 'bg-red-600 ring-2 ring-white' : 'bg-slate-800'}`}
        >
          <Zap className="mr-2 h-5 w-5 animate-bounce" /> VF
        </Button>
        <Button
          onClick={() => setType('asystole')}
          className={`h-16 ${type === 'asystole' ? 'bg-slate-600 ring-2 ring-white' : 'bg-slate-800'}`}
        >
          <Minus className="mr-2 h-5 w-5" /> Asystole
        </Button>
      </div>

      <div className="mt-8 text-slate-500 text-sm max-w-2xl text-center">
        <p>This demo uses high-performance SVG path manipulation to simulate cardiac rhythms mathematically. This approach is lightweight, doesn't require image assets, and provides a smooth 60FPS visualization.</p>
      </div>
    </div>
  );
}

// Helper Badge component since shadcn might not be exported here
function Badge({ children, className, variant }: any) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${className}`}>
      {children}
    </span>
  );
}
