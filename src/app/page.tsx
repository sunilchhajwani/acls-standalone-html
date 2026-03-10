'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DynamicECG } from '@/components/DynamicECG';
import { saveCase } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Heart,
  Activity,
  Zap,
  Clock,
  History,
  Play,
  Square,
  AlertTriangle,
  CheckCircle,
  Syringe,
  ArrowRight,
  UserCheck,
  Phone,
  Stethoscope,
  Monitor,
  AlertCircle,
  Droplets,
  Wind,
  Battery,
  Thermometer,
  CircuitBoard,
  Pill,
  PlayCircle,
  Gauge,
  Download,
  FileText
} from 'lucide-react';

// CPR Animation Styles
const cprAnimationStyles = `
  @keyframes compress {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(8px); }
  }
  @keyframes heartSqueeze {
    0%, 100% { transform: scale(1, 1); }
    50% { transform: scale(1.05, 0.85) translateY(18px); }
  }
  @keyframes lungExpand {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.25, 1.3); opacity: 1; }
  }
  @keyframes squeeze {
    0%, 100% { transform: scale(1, 1); }
    30%, 70% { transform: scale(0.7, 0.85); }
  }
  @keyframes shock {
    0%, 100% { transform: scale(1); opacity: 1; }
    25% { transform: scale(1.3); opacity: 0.8; }
    50% { transform: scale(0.9); opacity: 1; }
    75% { transform: scale(1.2); opacity: 0.9; }
  }
`;

// Types
interface ACLEvent {
  id: string;
  type: string;
  timestamp: Date;
  note: string;
  details?: Record<string, unknown>;
}

type RhythmType = 'unknown' | 'vf' | 'vt' | 'asystole' | 'pea' | 'bradycardia' | 'svt' | 'a_fib' | 'a_flutter' | 'torsades' | 'rosc' | 'stable_vt';

type AlgorithmStep =
  | 'initial_presentation'
  | 'check_responsiveness'
  | 'call_for_help'
  | 'check_pulse_breathing'
  | 'start_cpr'
  | 'attach_monitor'
  | 'rhythm_analysis'
  | 'shockable_rhythm'
  | 'non_shockable_rhythm'
  | 'deliver_shock'
  | 'resume_cpr'
  | 'give_epinephrine'
  | 'give_amiodarone'
  | 'check_rosc'
  | 'rosc_achieved'
  | 'post_rosc_care'
  | 'consider_cause'
  | 'wait_cpr_cycle'
  // Bradycardia steps
  | 'bradycardia_assessment'
  | 'bradycardia_symptomatic'
  | 'give_atropine'
  | 'consider_pacing'
  | 'bradycardia_infusion'
  // Tachyarrhythmia steps
  | 'tachycardia_assessment'
  | 'tachycardia_unstable_check'
  | 'tachycardia_unstable'
  | 'tachycardia_stable'
  | 'tachycardia_cardioversion'
  | 'tachycardia_rate_control'
  | 'tachycardia_svt_vagal'
  | 'tachycardia_svt_adenosine';

// Step configuration
const STEP_CONFIG: Record<AlgorithmStep, { title: string; description: string; priority: 'critical' | 'high' | 'normal' }> = {
  initial_presentation: { title: '🏥 Select Presentation', description: 'What is the patient\'s chief complaint?', priority: 'critical' },
  check_responsiveness: { title: '🚨 Check Responsiveness', description: 'Tap shoulders and shout "Are you okay?"', priority: 'critical' },
  call_for_help: { title: '📞 Call for Help', description: 'Activate emergency response. Get AED.', priority: 'critical' },
  check_pulse_breathing: { title: 'Check Pulse & Breathing', description: 'Check carotid pulse and breathing (5-10 sec max)', priority: 'critical' },
  start_cpr: { title: '💓 START HIGH-QUALITY CPR', description: '30:2 ratio. Rate: 100-120/min. Depth: 2-2.4 inches.', priority: 'critical' },
  attach_monitor: { title: 'Attach Cardiac Monitor', description: 'Apply defibrillator pads.', priority: 'high' },
  rhythm_analysis: { title: '📊 Analyze Rhythm', description: 'What is the cardiac rhythm?', priority: 'critical' },
  shockable_rhythm: { title: '⚡ SHOCKABLE RHYTHM', description: 'VF/VT detected. Prepare for defibrillation!', priority: 'critical' },
  non_shockable_rhythm: { title: '❌ Non-Shockable Rhythm', description: 'Asystole/PEA. Continue CPR. Give epinephrine.', priority: 'critical' },
  deliver_shock: { title: '⚡ DELIVER SHOCK', description: 'Clear patient. Deliver shock NOW.', priority: 'critical' },
  resume_cpr: { title: 'Resume CPR Immediately', description: 'Resume compressions after shock.', priority: 'critical' },
  give_epinephrine: { title: '💊 Epinephrine Due', description: 'Epinephrine 1mg IV/IO push.', priority: 'high' },
  give_amiodarone: { title: '💊 Amiodarone Due', description: 'After 3 shocks, give Amiodarone 300mg.', priority: 'high' },
  check_rosc: { title: 'Check for ROSC', description: 'Stop CPR. Check rhythm and pulse.', priority: 'critical' },
  rosc_achieved: { title: '✅ ROSC Achieved!', description: 'Return of Spontaneous Circulation!', priority: 'critical' },
  post_rosc_care: { title: 'Post-Cardiac Arrest Care', description: 'Optimize ventilation, hemodynamics.', priority: 'high' },
  consider_cause: { title: '🔍 Identify Reversible Cause', description: 'Check H\'s and T\'s.', priority: 'critical' },
  wait_cpr_cycle: { title: 'Continue CPR', description: 'Minimize interruptions.', priority: 'critical' },
  // Bradycardia
  bradycardia_assessment: { title: '💓 Bradycardia Detected', description: 'HR < 60 bpm. Assess for poor perfusion.', priority: 'critical' },
  bradycardia_symptomatic: { title: '⚠️ Symptomatic Bradycardia', description: 'Signs of poor perfusion. Begin treatment!', priority: 'critical' },
  give_atropine: { title: '💊 Give Atropine', description: '1.0mg IV q3-5min. Max: 3mg (3 doses).', priority: 'high' },
  consider_pacing: { title: '⚡ Consider Pacing/Infusion', description: 'Atropine max reached. Begin TCP or infusion.', priority: 'critical' },
  bradycardia_infusion: { title: '📉 Infusion Active', description: 'Dopamine or Epinephrine infusion.', priority: 'high' },
  // Tachyarrhythmia
  tachycardia_assessment: { title: '⚡ Tachycardia Detected', description: 'HR > 150 bpm. Assess stability.', priority: 'critical' },
  tachycardia_unstable_check: { title: '⚠️ Check for Unstable Signs', description: 'Assess for signs of instability.', priority: 'critical' },
  tachycardia_unstable: { title: '🚨 UNSTABLE Tachycardia', description: 'Immediate synchronized cardioversion!', priority: 'critical' },
  tachycardia_stable: { title: '✓ STABLE Tachycardia', description: 'Rate control or rhythm control.', priority: 'high' },
  tachycardia_cardioversion: { title: '⚡ Prepare Cardioversion', description: 'Synchronized cardioversion ready.', priority: 'critical' },
  tachycardia_rate_control: { title: '💊 Rate Control', description: 'Consider medications for rate control.', priority: 'high' },
  tachycardia_svt_vagal: { title: '💨 Vagal Maneuvers', description: 'Try vagal maneuvers first for SVT.', priority: 'high' },
  tachycardia_svt_adenosine: { title: '💊 Adenosine', description: 'Rapid push: 6mg → 12mg → 12mg.', priority: 'high' },
};

// Reversible causes (H's and T's)
const REVERSIBLE_CAUSES = [
  { label: 'Hypovolemia', icon: Droplets, action: 'Fluid bolus' },
  { label: 'Hypoxia', icon: Wind, action: 'Oxygenate/ventilate' },
  { label: 'Hydrogen ion (Acidosis)', icon: Activity, action: 'Hypoventilation, consider NaHCO3' },
  { label: 'Hypo/Hyperkalemia', icon: Battery, action: 'Treat electrolyte imbalance' },
  { label: 'Hypothermia', icon: Thermometer, action: 'Active warming' },
  { label: 'Tension Pneumothorax', icon: Wind, action: 'Needle decompression' },
  { label: 'Tamponade (Cardiac)', icon: Heart, action: 'Pericardiocentesis' },
  { label: 'Toxins/Poisoning', icon: AlertTriangle, action: 'Specific antidote' },
  { label: 'Thrombosis (PE)', icon: CircuitBoard, action: 'Consider thrombolysis' },
  { label: 'Thrombosis (MI)', icon: Heart, action: 'PCI/thrombolysis' },
];

// Bradycardia symptoms
const BRADYCARDIA_SYMPTOMS = [
  { id: 'hypotension', label: 'Hypotension (SBP < 90)', critical: true },
  { id: 'altered_mental', label: 'Altered mental status', critical: true },
  { id: 'chest_pain', label: 'Chest pain', critical: true },
  { id: 'shock_signs', label: 'Signs of shock', critical: true },
  { id: 'heart_failure', label: 'Acute heart failure', critical: true },
  { id: 'syncope', label: 'Syncope/near-syncope', critical: false },
  { id: 'dizziness', label: 'Dizziness/lightheadedness', critical: false },
];

// Tachycardia unstable signs
const TACHYCARDIA_UNSTABLE_SIGNS = [
  { id: 'hypotension', label: 'Hypotension (SBP < 90)', critical: true },
  { id: 'altered_mental', label: 'Altered mental status', critical: true },
  { id: 'chest_pain', label: 'Chest pain (ischemic)', critical: true },
  { id: 'heart_failure', label: 'Acute heart failure', critical: true },
  { id: 'shock_signs', label: 'Signs of shock', critical: true },
];

// Cardioversion energies by rhythm
const CARDIOVERSION_ENERGY: Record<string, { first: number; second: number; third: number }> = {
  'svt': { first: 50, second: 100, third: 200 },
  'a_fib': { first: 200, second: 200, third: 200 },
  'a_flutter': { first: 50, second: 100, third: 200 },
  'stable_vt': { first: 100, second: 150, third: 200 },
};

// Helper functions
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

export default function ACLSTool() {
  // Core state
  const [caseStartTime, setCaseStartTime] = useState<Date | null>(null);
  const [caseActive, setCaseActive] = useState(false);
  const [events, setEvents] = useState<ACLEvent[]>([]);

  // Algorithm state
  const [currentStep, setCurrentStep] = useState<AlgorithmStep>('initial_presentation');
  const [rhythmType, setRhythmType] = useState<RhythmType>('unknown');
  const [isPulsePresent, setIsPulsePresent] = useState<boolean | null>(null);

  // CPR state
  const [cprActive, setCprActive] = useState(false);
  const [cprCycleTime, setCprCycleTime] = useState(0);
  const [cprPhase, setCprPhase] = useState<'compression' | 'ventilation'>('compression');
  const [compressionCount, setCompressionCount] = useState(0);
  const [breathCount, setBreathCount] = useState(0);
  const [compressionRate, setCompressionRate] = useState(110);
  const [isIntubated, setIsIntubated] = useState(false);
  const [ventilationTimer, setVentilationTimer] = useState(0);

  // Bradycardia state
  const [bradycardiaSymptoms, setBradycardiaSymptoms] = useState<Record<string, boolean>>({});
  const [atropineDoses, setAtropineDoses] = useState(0);
  const [pacingActive, setPacingActive] = useState(false);
  const [infusionType, setInfusionType] = useState<'dopamine' | 'epinephrine' | null>(null);
  const [infusionRate, setInfusionRate] = useState(0);

  // Tachyarrhythmia state
  const [tachyUnstableSigns, setTachyUnstableSigns] = useState<Record<string, boolean>>({});
  const [tachyRhythm, setTachyRhythm] = useState<'svt' | 'a_fib' | 'a_flutter' | 'stable_vt' | null>(null);
  const [cardioversionCount, setCardioversionCount] = useState(0);
  const [adenosineDoses, setAdenosineDoses] = useState(0);
  const [vagalAttempted, setVagalAttempted] = useState(false);

  // Outcome tracking state
  const [pendingOutcome, setPendingOutcome] = useState<string | null>(null);
  const [interventionOutcomes, setInterventionOutcomes] = useState<Record<string, 'stabilized' | 'not_stabilized'>>({});

  // Counters
  const [shockCount, setShockCount] = useState(0);
  const [epinephrineCount, setEpinephrineCount] = useState(0);
  const [lastEpinephrineTime, setLastEpinephrineTime] = useState(0);
  const [cprCycles, setCprCycles] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [roscAchieved, setRoscAchieved] = useState(false);
  const [dueAction, setDueAction] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(true);

  // New Feature state
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [voicePromptsEnabled, setVoicePromptsEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState<'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'kn'>('en');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Megacode / Training State
  const [isMegacodeMode, setIsMegacodeMode] = useState(false);
  const [useLiveECG, setUseLiveECG] = useState(true);
  const [ecgSpeed, setEcgSpeed] = useState(0.6);
  const [activeScenario, setActiveScenario] = useState<{
    id: string;
    name: string;
    description?: string;
    ecgImage?: string;
    initialRhythm: RhythmType;
    currentRhythm: RhythmType;
    steps: { rhythm: RhythmType; trigger: 'action'; value: string; ecgImage?: string }[];
    currentStepIndex: number;
    startTime: number | null;
  } | null>(null);

  const [evaluation, setEvaluation] = useState<{
    score: number;
    criticalFailures: string[];
    passed: boolean;
    feedback: string[];
    stats: {
      timeToFirstShock: number | null;
      epiIntervals: number[];
      cprInterruptionTime: number;
    };
  } | null>(null);

  // Scenario Definitions (AHA Megacode Standard)
  const SCENARIOS: Array<{
    id: string;
    name: string;
    description: string;
    initialRhythm: RhythmType;
    ecgImage: string;
    steps: { rhythm: RhythmType; trigger: 'action'; value: string; ecgImage?: string }[];
  }> = [
      {
        id: 'vf_refractory',
        name: 'Scenario: Acute MI to VF',
        description: 'A 65-year-old male with severe chest pain and diaphoresis. Monitor shows VF.',
        initialRhythm: 'vf',
        ecgImage: '/ecg/vf.jpg',
        steps: [
          { rhythm: 'vf', trigger: 'action', value: 'shock' },
          { rhythm: 'vf', trigger: 'action', value: 'shock' },
          { rhythm: 'asystole', trigger: 'action', value: 'shock', ecgImage: '/ecg/asystole.jpg' },
        ]
      },
      {
        id: 'pea_to_vf',
        name: 'Scenario: Drug Overdose to PEA',
        description: 'A 28-year-old female found unconscious. No pulse. Monitor shows PEA.',
        initialRhythm: 'pea',
        ecgImage: '/ecg/pea.jpg',
        steps: [
          { rhythm: 'pea', trigger: 'action', value: 'epinephrine' },
          { rhythm: 'vf', trigger: 'action', value: 'epinephrine', ecgImage: '/ecg/vf.jpg' },
        ]
      },
      {
        id: 'brady_to_pea',
        name: 'Scenario: Sinus Bradycardia to Arrest',
        description: 'A 75-year-old male with dizziness and HR of 35. Hypotensive.',
        initialRhythm: 'bradycardia',
        ecgImage: '/ecg/brady.jpg',
        steps: [
          { rhythm: 'bradycardia', trigger: 'action', value: 'atropine' },
          { rhythm: 'pea', trigger: 'action', value: 'atropine', ecgImage: '/ecg/pea.jpg' },
        ]
      },
      {
        id: 'vt_to_vf',
        name: 'Scenario: COPD/Hypoxia to Unstable VT',
        description: 'A 50-year-old female with asthma exacerbation. Agitated, hypotensive, HR 170.',
        initialRhythm: 'stable_vt',
        ecgImage: '/ecg/vt.jpg',
        steps: [
          { rhythm: 'stable_vt', trigger: 'action', value: 'cardioversion' },
          { rhythm: 'vf', trigger: 'action', value: 'cardioversion', ecgImage: '/ecg/vf.jpg' },
        ]
      }
    ];

  // Translations
  const TRANSLATIONS = {
    hi: {
      shock: "Defibrillation ka samay hai. Turant shock dein.",
      rosc_check: "ROSC ki jaanch karein. C P R rokein, pulse aur rhythm check karein.",
      epinephrine: "Epinephrine ka samay ho gaya hai. Abhi ek milligram dein.",
      amiodarone_300: "Amiodarone ka samay hai. Teen-sau milligram dein.",
      amiodarone_150: "Amiodarone ka samay hai. Ek-sau-pachaas milligram dein.",
      atropine: "Atropine ek milligram dein.",
      adenosine: "Adenosine rapid bolus par vichaar karein.",
      pacing: "Transcutaneous pacing ya infusion par vichaar karein.",
      unstable: "Rhythm unstable hai. Synchronized cardioversion taiyaar karein.",
      start_cpr: "Abhi C P R shuru karein.",
      rhythm_check_10s: "Das second mein rhythm check ke liye taiyaar rahein.",
    },
    mr: { // Marathi
      shock: "Defibrillation ची वेळ झाली आहे. ताबडतोब shock द्या.",
      rosc_check: "ROSC तपासा. CPR थांबवा, pulse आणि rhythm तपासा.",
      epinephrine: "Epinephrine ची वेळ झाली आहे. आता एक milligram द्या.",
      amiodarone_300: "Amiodarone ची वेळ झाली आहे. ३०० milligram द्या.",
      amiodarone_150: "Amiodarone ची वेळ झाली आहे. १५० milligram द्या.",
      atropine: "Atropine १.० milligram द्या.",
      adenosine: "Adenosine rapid bolus चा विचार करा.",
      pacing: "Transcutaneous pacing किंवा infusion चा विचार करा.",
      unstable: "Rhythm unstable आहे. Synchronized cardioversion तयार ठेवा.",
      start_cpr: "आता CPR सुरू करा.",
      rhythm_check_10s: "दहा सेकंदात rhythm check साठी तयार रहा.",
    },
    ta: { // Tamil
      shock: "Defibrillation நேரம் இது. உடனடியாக shock கொடுங்கள்.",
      rosc_check: "ROSC ஐச் சரிபார்க்கவும். CPR ஐ நிறுத்தி, pulse மற்றும் rhythm ஐச் சரிபார்க்கவும்.",
      epinephrine: "Epinephrine கொடுக்க வேண்டிய நேரம் இது. இப்போது ஒரு milligram கொடுங்கள்.",
      amiodarone_300: "Amiodarone நேரம். ৩০০ milligram கொடுங்கள்.",
      amiodarone_150: "Amiodarone நேரம். ১৫০ milligram கொடுங்கள்.",
      atropine: "Atropine १.० milligram கொடுங்கள்.",
      adenosine: "Adenosine rapid bolus ஐப் பரிசீலிக்கவும்.",
      pacing: "Transcutaneous pacing அல்லது infusion ஐப் பரிசீலிக்கவும்.",
      unstable: "Rhythm unstable ஆக உள்ளது. Synchronized cardioversion தயார் செய்யவும்.",
      start_cpr: "இப்போது CPR ஐத் தொடங்குங்கள்.",
      rhythm_check_10s: "பத்து வினாடிகளில் rhythm check க்குத் தயாராகுங்கள்.",
    },
    te: { // Telugu
      shock: "Defibrillation సమయం ఆసన్నమైంది. వెంటనే shock ఇవ్వండి.",
      rosc_check: "ROSC కోసం తనిఖీ చేయండి. CPR ని ఆపండి, pulse మరియు rhythm తనిఖీ చేయండి.",
      epinephrine: "Epinephrine ఇచ్చే సమయం. ఇప్పుడు ఒక milligram ఇవ్వండి.",
      amiodarone_300: "Amiodarone సమయం. 300 milligram ఇవ్వండి.",
      amiodarone_150: "Amiodarone సమయం. 150 milligram ఇవ్వండి.",
      atropine: "Atropine 1.0 milligram ఇవ్వండి.",
      adenosine: "Adenosine rapid bolus గురించి ఆలోచించండి.",
      pacing: "Transcutaneous pacing లేదా infusion గురించి ఆలోచించండి.",
      unstable: "Rhythm unstable గా ఉంది. Synchronized cardioversion సిద్ధం చేయండి.",
      start_cpr: "ఇప్పుడే CPR ప్రారంభించండి.",
      rhythm_check_10s: "పది సెకన్లలో rhythm check కోసం సిద్ధంగా ఉండండి.",
    },
    bn: { // Bengali
      shock: "Defibrillation এর সময় হয়েছে। অবিলম্বে shock দিন।",
      rosc_check: "ROSC পরীক্ষা করুন। CPR বন্ধ করুন, pulse এবং rhythm পরীক্ষা করুন।",
      epinephrine: "Epinephrine এর সময় হয়েছে। এখন এক milligram দিন।",
      amiodarone_300: "Amiodarone এর সময়। ৩০০ milligram দিন।",
      amiodarone_150: "Amiodarone এর সময়। ১৫০ milligram দিন।",
      atropine: "Atropine ১.০ milligram দিন।",
      adenosine: "Adenosine rapid bolus এর কথা বিবেচনা করুন।",
      pacing: "Transcutaneous pacing বা infusion এর কথা বিবেচনা করুন।",
      unstable: "Rhythm unstable। Synchronized cardioversion তৈরি করুন।",
      start_cpr: "এখনই CPR শুরু করুন।",
      rhythm_check_10s: "দশ সেকেন্ডের মধ্যে rhythm check এর জন্য প্রস্তুত হন।",
    },
    kn: { // Kannada
      shock: "Defibrillation ಸಮಯ ಬಂದಿದೆ. ಕೂಡಲೇ shock ನೀಡಿ.",
      rosc_check: "ROSC ಗಾಗಿ ಪರೀಕ್ಷಿಸಿ. CPR ನಿಲ್ಲಿಸಿ, pulse ಮತ್ತು rhythm ಪರೀಕ್ಷಿಸಿ.",
      epinephrine: "Epinephrine ನೀಡುವ ಸಮಯ. ಈಗ ಒಂದು milligram ನೀಡಿ.",
      amiodarone_300: "Amiodarone ಸಮಯ. ೩೦೦ milligram ನೀಡಿ.",
      amiodarone_150: "Amiodarone ಸಮಯ. ೧೫೦ milligram ನೀಡಿ.",
      atropine: "Atropine ೧.೦ milligram ನೀಡಿ.",
      adenosine: "Adenosine rapid bolus ಬಗ್ಗೆ ಪರಿಗಣಿಸಿ.",
      pacing: "Transcutaneous pacing ಅಥವಾ infusion ಬಗ್ಗೆ ಪರಿಗಣಿಸಿ.",
      unstable: "Rhythm unstable ಆಗಿದೆ. Synchronized cardioversion ಸಿದ್ಧಪಡಿಸಿ.",
      start_cpr: "ಈಗಲೇ CPR ಪ್ರಾರಂಭಿಸಿ.",
      rhythm_check_10s: "ಹತ್ತು ಸೆಕೆಂಡುಗಳಲ್ಲಿ rhythm check ಗಾಗಿ ಸಿದ್ಧರಾಗಿ.",
    },
  };

  // Refs
  const cprIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const compressionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ventilationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTimerRef = useRef(0);
  const alertBannerRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Check if we're in arrhythmia pathway (to hide CPR elements)
  const isArrhythmiaPathway = rhythmType === 'bradycardia' ||
    ['svt', 'a_fib', 'a_flutter', 'stable_vt'].includes(rhythmType) ||
    ['bradycardia_assessment', 'bradycardia_symptomatic', 'give_atropine', 'consider_pacing', 'bradycardia_infusion',
      'tachycardia_assessment', 'tachycardia_unstable_check', 'tachycardia_unstable', 'tachycardia_stable',
      'tachycardia_cardioversion', 'tachycardia_rate_control', 'tachycardia_svt_vagal', 'tachycardia_svt_adenosine'
    ].includes(currentStep);

  // Auto-scroll effect
  useEffect(() => {
    if (dueAction && alertBannerRef.current) {
      alertBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (currentStepRef.current && !dueAction) {
      currentStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, dueAction]);

  // Add event
  const addEvent = useCallback((type: string, note: string, details?: Record<string, unknown>) => {
    const newEvent: ACLEvent = { id: crypto.randomUUID(), type, timestamp: new Date(), note, details };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  // Audio Context and Metronome
  const playMetronomeClick = useCallback((isBreath?: boolean) => {
    if (!metronomeEnabled) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isBreath ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isBreath ? 400 : 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isBreath ? 0.3 : 0.1));

    gain.gain.setValueAtTime(isBreath ? 0.4 : 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isBreath ? 0.3 : 0.1));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (isBreath ? 0.3 : 0.1));
  }, [metronomeEnabled]);

  // Voice Initialization
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        setAvailableVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Voice Prompts
  const speakPrompt = useCallback((message: string, translationKey?: keyof typeof TRANSLATIONS.hi) => {
    if (!voicePromptsEnabled || !window.speechSynthesis) return;

    // Stop previous and clear queue to ensure priority for the new alert
    window.speechSynthesis.cancel();

    const actualMessage = (voiceLanguage !== 'en' && translationKey) ? TRANSLATIONS[voiceLanguage][translationKey] : message;
    const utterance = new SpeechSynthesisUtterance(actualMessage);

    // Try to find a high-quality voice for the selected language
    let selectedVoice: SpeechSynthesisVoice | undefined = undefined;

    if (voiceLanguage !== 'en') {
      // Mapping internal codes to browser language codes
      const langMap: Record<string, { code: string; names: string[] }> = {
        hi: { code: 'hi', names: ['Lekha', 'Google हिन्दी', 'Hindi'] },
        mr: { code: 'mr', names: ['Google मराठी', 'Marathi'] },
        ta: { code: 'ta', names: ['Google தமிழ்', 'Tamil'] },
        te: { code: 'te', names: ['Google తెలుగు', 'Telugu'] },
        bn: { code: 'bn', names: ['Google বাংলা', 'Bengali'] },
        kn: { code: 'kn', names: ['Google ಕನ್ನಡ', 'Kannada'] },
      };

      const config = langMap[voiceLanguage];
      if (config) {
        for (const name of config.names) {
          selectedVoice = availableVoices.find(v => v.name.includes(name) && v.lang.startsWith(config.code));
          if (selectedVoice) break;
        }
        if (!selectedVoice) selectedVoice = availableVoices.find(v => v.lang.startsWith(config.code));
      }
    }

    // Fallback to English if no regional voice found OR if language is English
    if (!selectedVoice) {
      const preferredVoices = ['Google US English', 'Samantha', 'Microsoft David', 'Daniel'];
      for (const name of preferredVoices) {
        selectedVoice = availableVoices.find(v => v.name.includes(name) && v.lang.startsWith('en'));
        if (selectedVoice) break;
      }
      if (!selectedVoice) selectedVoice = availableVoices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = voiceLanguage === 'en' ? 1.1 : 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }, [voicePromptsEnabled, availableVoices, voiceLanguage, TRANSLATIONS]);

  const checkScenarioProgression = useCallback((action: string) => {
    if (!isMegacodeMode || !activeScenario) return;

    const nextStep = activeScenario.steps[activeScenario.currentStepIndex];
    if (nextStep && nextStep.trigger === 'action' && nextStep.value === action) {
      const nextIndex = activeScenario.currentStepIndex + 1;
      const newRhythm = nextStep.rhythm;

      setActiveScenario(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentRhythm: newRhythm,
          currentStepIndex: nextIndex
        };
      });

      addEvent('scenario_update', `Patient status changed internally (Hidden)`);
    }
  }, [isMegacodeMode, activeScenario, addEvent]);

  // Record outcome of intervention
  const recordOutcome = useCallback((interventionId: string, outcome: 'stabilized' | 'not_stabilized') => {
    setInterventionOutcomes(prev => ({ ...prev, [interventionId]: outcome }));
    addEvent('outcome', `${interventionId}: ${outcome === 'stabilized' ? '✅ Patient Stabilized' : '❌ Not Stabilized'}`);
    setPendingOutcome(null);
  }, [addEvent]);

  // Clear all
  const clearAll = useCallback(() => {
    setEvents([]);
    setShockCount(0);
    setEpinephrineCount(0);
    setLastEpinephrineTime(0);
    setCprCycles(0);
    setCprCycleTime(0);
    setCprActive(false);
    setRhythmType('unknown');
    setIsPulsePresent(null);
    setRoscAchieved(false);
    setCurrentStep('initial_presentation');
    setDueAction(null);
    setIsIntubated(false);
    setVentilationTimer(0);
    setCprPhase('compression');
    setCompressionCount(0);
    setBreathCount(0);
    setBradycardiaSymptoms({});
    setAtropineDoses(0);
    setPacingActive(false);
    setInfusionType(null);
    setInfusionRate(0);
    setTachyUnstableSigns({});
    setTachyRhythm(null);
    setCardioversionCount(0);
    setAdenosineDoses(0);
    setVagalAttempted(false);
    setPendingOutcome(null);
    setInterventionOutcomes({});
  }, []);

  const forceRhythmChange = useCallback((newRhythm: RhythmType) => {
    if (!activeScenario) return;
    setActiveScenario(prev => {
      if (!prev) return null;
      return { ...prev, currentRhythm: newRhythm };
    });
    addEvent('instructor_override', `Instructor forced rhythm change to: ${newRhythm.toUpperCase()}`);
    setDueAction('rosc_check'); // Force a check
    setCurrentStep('check_rosc');
  }, [activeScenario, addEvent]);

  // Evaluate performance based on AHA standards
  const getEvaluationData = useCallback(() => {
    const feedback: string[] = [];
    const criticalFailures: string[] = [];
    let score = 100;

    // 1. Time to First Shock (Target < 120s)
    const shockEvents = events.filter(e => e.type === 'defibrillation');
    if (shockEvents.length > 0 && caseStartTime) {
      const firstShockTime = (shockEvents[0].timestamp.getTime() - caseStartTime.getTime()) / 1000;
      if (firstShockTime > 120) {
        criticalFailures.push("First shock delayed (>2 mins)");
        score -= 20;
      } else {
        feedback.push(`Excellent shock timing: ${Math.round(firstShockTime)}s`);
      }
    }

    // 2. Epinephrine Interval (Target 3-5 mins)
    const epiEvents = events.filter(e => e.note.includes('Epinephrine'));
    for (let i = 1; i < epiEvents.length; i++) {
      const interval = (epiEvents[i].timestamp.getTime() - epiEvents[i - 1].timestamp.getTime()) / 1000;
      if (interval < 150) {
        feedback.push("Epinephrine given too early (<3 mins)");
        score -= 10;
      } else if (interval > 330) {
        feedback.push("Epinephrine significantly delayed (>5 mins)");
        score -= 10;
      }
    }

    // 3. CPR Cycle Adherence
    if (cprCycles < 1 && !roscAchieved) {
      criticalFailures.push("Insufficient CPR cycles performed");
      score -= 30;
    }

    return {
      score: Math.max(0, score),
      criticalFailures,
      passed: criticalFailures.length === 0 && score >= 70,
      feedback,
      stats: {
        timeToFirstShock: (shockEvents.length > 0 && caseStartTime) ? (shockEvents[0].timestamp.getTime() - caseStartTime.getTime()) / 1000 : null,
        epiIntervals: [],
        cprInterruptionTime: 0
      }
    };
  }, [events, caseStartTime, cprCycles, roscAchieved]);

  const evaluatePerformance = useCallback(() => {
    setEvaluation(getEvaluationData());
  }, [getEvaluationData]);

  const startMegacode = useCallback((scenarioId: string) => {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return;

    clearAll();
    setIsMegacodeMode(true);
    setActiveScenario({
      ...scenario,
      currentRhythm: scenario.initialRhythm,
      ecgImage: scenario.ecgImage,
      currentStepIndex: 0,
      startTime: Date.now()
    });
    setCaseStartTime(new Date());
    setCaseActive(true);
    setRhythmType(scenario.initialRhythm);
    setCurrentStep('start_cpr');
    addEvent('megacode_start', `Evaluation Started: ${scenario.name}`);
  }, [clearAll, addEvent]);

  // Start/End case
  const startCase = useCallback(() => {
    const now = new Date();
    setCaseStartTime(now);
    setCaseActive(true);
    setIsMegacodeMode(false);
    setActiveScenario(null);
    setEvaluation(null);
    setCurrentStep('initial_presentation');
    addEvent('case_start', 'ACLS Case Started');
  }, [addEvent]);

  const endCase = useCallback(async () => {
    setCprActive(false);
    setCaseActive(false);

    let evaluationData: any = null;
    if (isMegacodeMode) {
      evaluationData = getEvaluationData();
      setEvaluation(evaluationData);
    }

    const finalEvent = { id: crypto.randomUUID(), type: 'case_end', note: 'ACLS Case Ended', timestamp: new Date() };
    const allEvents = [...events, finalEvent];
    setEvents(allEvents);

    // Auto-save to database
    try {
      saveCase({
        startTime: caseStartTime,
        endTime: new Date(),
        duration: elapsedTime,
        initialRhythm: isMegacodeMode ? activeScenario?.initialRhythm : 'unknown',
        finalRhythm: rhythmType,
        roscAchieved,
        isMegacode: isMegacodeMode,
        scenarioName: activeScenario?.name || 'Manual Case',
        score: evaluationData?.score,
        passed: evaluationData?.passed,
        criticalFailures: evaluationData?.criticalFailures,
        feedback: evaluationData?.feedback,
        shocks: shockCount,
        epinephrine: epinephrineCount,
        cprCycles,
        events: allEvents
      });
    } catch (error) {
      console.error("Failed to auto-save case:", error);
    }
  }, [addEvent, isMegacodeMode, getEvaluationData, events, caseStartTime, elapsedTime, rhythmType, roscAchieved, activeScenario, shockCount, epinephrineCount, cprCycles]);

  // CPR functions
  const startCPR = useCallback(() => {
    setCprActive(true);
    setCprCycleTime(0);
    addEvent('cpr_start', 'CPR Started');
  }, [addEvent]);

  const stopCPR = useCallback(() => {
    setCprActive(false);
    addEvent('cpr_stop', 'CPR Stopped');
  }, [addEvent]);

  // CPR timer effect - handles cycle timing and 2-minute cycle completion
  const handleCprCycleComplete = useCallback(() => {
    setCprCycles(prev => prev + 1);
    addEvent('cpr_cycle', '2-minute CPR cycle complete');
    setCprActive(false);
    addEvent('cpr_stop', 'CPR Stopped');
    setDueAction('rosc_check');
    if (!roscAchieved) setCurrentStep('check_rosc');
  }, [addEvent, roscAchieved]);

  useEffect(() => {
    if (cprActive) {
      cprIntervalRef.current = setInterval(() => {
        setCprCycleTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 120) {
            // Handle cycle complete in the next tick to avoid setState in render
            setTimeout(() => handleCprCycleComplete(), 0);
            return 0; // Reset timer
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (cprIntervalRef.current) clearInterval(cprIntervalRef.current);
    }
    return () => { if (cprIntervalRef.current) clearInterval(cprIntervalRef.current); };
  }, [cprActive, handleCprCycleComplete]);

  // CPR simulation
  useEffect(() => {
    if (!cprActive || roscAchieved) {
      if (compressionIntervalRef.current) clearInterval(compressionIntervalRef.current);
      // Reset state only when transitioning from active to inactive
      return () => {
        setCprPhase('compression');
        setCompressionCount(0);
        setBreathCount(0);
        phaseTimerRef.current = 0;
      };
    }

    const msPerCompression = Math.round((60 / compressionRate) * 1000);

    if (isIntubated) {
      compressionIntervalRef.current = setInterval(() => {
        phaseTimerRef.current += 100;
        if (phaseTimerRef.current >= msPerCompression) {
          phaseTimerRef.current = 0;
          playMetronomeClick(false);
          setCompressionCount(prev => prev >= 999 ? 0 : prev + 1);
        }
      }, 100);
    } else {
      compressionIntervalRef.current = setInterval(() => {
        phaseTimerRef.current += 100;
        if (cprPhase === 'compression') {
          if (phaseTimerRef.current >= msPerCompression) {
            phaseTimerRef.current = 0;
            playMetronomeClick(false);
            setCompressionCount(prev => {
              if (prev >= 29) {
                setCprPhase('ventilation');
                setBreathCount(0);
                return 0;
              }
              return prev + 1;
            });
          }
        } else if (cprPhase === 'ventilation') {
          if (phaseTimerRef.current >= 2000) {
            phaseTimerRef.current = 0;
            playMetronomeClick(true);
            setBreathCount(prev => {
              if (prev >= 1) {
                setCprPhase('compression');
                setCompressionCount(0);
                return 0;
              }
              return prev + 1;
            });
          }
        }
      }, 100);
    }

    return () => { if (compressionIntervalRef.current) clearInterval(compressionIntervalRef.current); };
  }, [cprActive, roscAchieved, cprPhase, compressionRate, isIntubated, playMetronomeClick]);

  // Ventilation for intubated patients
  useEffect(() => {
    if (!cprActive || roscAchieved || !isIntubated) {
      if (ventilationIntervalRef.current) clearInterval(ventilationIntervalRef.current);
      return () => {
        setVentilationTimer(0);
      };
    }

    ventilationIntervalRef.current = setInterval(() => {
      setVentilationTimer(prev => {
        const newTimer = prev + 1;
        if (newTimer >= 6) {
          setBreathCount(b => b + 1);
          return 0;
        }
        return newTimer;
      });
    }, 1000);

    return () => { if (ventilationIntervalRef.current) clearInterval(ventilationIntervalRef.current); };
  }, [cprActive, roscAchieved, isIntubated]);

  // Elapsed time effect
  useEffect(() => {
    if (caseActive && caseStartTime) {
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - caseStartTime.getTime()) / 1000));
      }, 1000);
      return () => { if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current); };
    } else {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      return () => { setElapsedTime(0); };
    }
  }, [caseActive, caseStartTime]);

  // Track when CPR cycle is handled
  const cprCycleHandledRef = useRef(false);
  useEffect(() => {
    // Reset the ref when CPR becomes active again
    if (cprActive) {
      cprCycleHandledRef.current = false;
    }
  }, [cprActive]);

  // Flash animation
  useEffect(() => {
    if (dueAction) {
      flashIntervalRef.current = setInterval(() => setFlashOn(prev => !prev), 500);
      return () => { if (flashIntervalRef.current) clearInterval(flashIntervalRef.current); };
    } else {
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
      return () => { setFlashOn(true); };
    }
  }, [dueAction]);

  // Voice prompt due action triggers
  useEffect(() => {
    if (dueAction === 'shock') {
      speakPrompt("Defibrillation due now. Deliver shock immediately.", 'shock');
    } else if (dueAction === 'rosc_check') {
      speakPrompt("Check for ROSC. Stop C P R, check pulse and rhythm.", 'rosc_check');
    }
  }, [dueAction, speakPrompt]);

  // Voice prompt step triggers
  useEffect(() => {
    switch (currentStep) {
      case 'give_epinephrine':
        speakPrompt("Epinephrine due. Give 1 milligram now.", 'epinephrine');
        break;
      case 'give_amiodarone':
        const amioKey = shockCount >= 5 ? 'amiodarone_150' : 'amiodarone_300';
        speakPrompt(`Amiodarone due. Give ${shockCount >= 5 ? '150' : '300'} milligrams now.`, amioKey);
        break;
      case 'give_atropine':
        speakPrompt("Give Atropine 1.0 milligram now.", 'atropine');
        break;
      case 'tachycardia_svt_adenosine':
        speakPrompt("Consider Adenosine rapid bolus now.", 'adenosine');
        break;
      case 'consider_pacing':
        speakPrompt("Consider transcutaneous pacing or infusion.", 'pacing');
        break;
      case 'tachycardia_unstable':
        speakPrompt("Unstable rhythm. Prepare synchronized cardioversion.", 'unstable');
        break;
      case 'start_cpr':
        speakPrompt("Start C P R now.", 'start_cpr');
        break;
    }
  }, [currentStep, speakPrompt, shockCount]);

  // Voice prompt 10-second CPR warning
  useEffect(() => {
    if (cprCycleTime === 110 && cprActive && !roscAchieved) {
      speakPrompt("Prepare for rhythm check in 10 seconds.", 'rhythm_check_10s');
    }
  }, [cprCycleTime, cprActive, roscAchieved, speakPrompt]);

  // Get recommended shock energy (Biphasic - 200J for all shocks)
  const getRecommendedEnergy = useCallback(() => 200, []);

  // Get cardioversion energy
  const getCardioversionEnergy = useCallback(() => {
    if (!tachyRhythm) return 100;
    const energies = CARDIOVERSION_ENERGY[tachyRhythm];
    if (!energies) return 100;
    if (cardioversionCount === 0) return energies.first;
    if (cardioversionCount === 1) return energies.second;
    return energies.third;
  }, [tachyRhythm, cardioversionCount]);

  // Handlers
  const handlePatientUnresponsive = useCallback(() => {
    addEvent('assessment', 'Patient unresponsive');
    setCurrentStep('call_for_help');
  }, [addEvent]);

  const handleHelpCalled = useCallback(() => {
    addEvent('help', 'Emergency response activated');
    setCurrentStep('check_pulse_breathing');
  }, [addEvent]);

  const handleNoPulse = useCallback(() => {
    setIsPulsePresent(false);
    addEvent('assessment', 'No pulse - Cardiac arrest confirmed');
    setCurrentStep('start_cpr');
  }, [addEvent]);

  const handleHasPulse = useCallback(() => {
    setIsPulsePresent(true);
    addEvent('assessment', 'Pulse present');
    setCurrentStep('rhythm_analysis');
  }, [addEvent]);

  const handleCPRStarted = useCallback(() => {
    startCPR();
    setCurrentStep('attach_monitor');
  }, [startCPR]);

  const handleMonitorAttached = useCallback(() => {
    addEvent('monitor', 'Cardiac monitor attached');
    setCurrentStep('rhythm_analysis');
  }, [addEvent]);

  const handleRhythmSelect = useCallback((rhythm: RhythmType) => {
    // In Megacode mode, selecting a rhythm is an ASSESSMENT step
    if (isMegacodeMode && activeScenario) {
      if (rhythm === activeScenario.currentRhythm) {
        addEvent('assessment', `✅ Correct Rhythm Identification: ${rhythm.toUpperCase()}`);
      } else {
        addEvent('assessment', `❌ Incorrect Rhythm Identification (Selected ${rhythm.toUpperCase()}, Patient is actually in ${activeScenario.currentRhythm.toUpperCase()})`);
        // Force the internal state to the ACTUAL scenario rhythm to keep algorithm moving
        setRhythmType(activeScenario.currentRhythm);
        rhythm = activeScenario.currentRhythm;
      }
    }

    setRhythmType(rhythm);
    addEvent('rhythm', `Rhythm identified: ${rhythm.toUpperCase()}`, { rhythm });

    if (rhythm === 'vf' || rhythm === 'vt' || rhythm === 'torsades') {
      setCurrentStep('shockable_rhythm');
      setDueAction('shock');
    } else if (rhythm === 'asystole' || rhythm === 'pea') {
      setCurrentStep('non_shockable_rhythm');
    } else if (rhythm === 'bradycardia') {
      setCurrentStep('bradycardia_assessment');
      setBradycardiaSymptoms({});
    } else if (rhythm === 'svt' || rhythm === 'a_fib' || rhythm === 'a_flutter' || rhythm === 'stable_vt') {
      setTachyRhythm(rhythm as 'svt' | 'a_fib' | 'a_flutter' | 'stable_vt');
      setCurrentStep('tachycardia_unstable_check');
      setTachyUnstableSigns({});
    }
  }, [addEvent, isMegacodeMode, activeScenario]);

  // Bradycardia handlers
  const handleSymptomCheck = useCallback((symptomId: string, checked: boolean) => {
    setBradycardiaSymptoms(prev => ({ ...prev, [symptomId]: checked }));
  }, []);

  const handleSymptomsConfirmed = useCallback(() => {
    const isSymptomatic = Object.values(bradycardiaSymptoms).some(v => v);
    if (isSymptomatic) {
      addEvent('bradycardia', '⚠️ Symptomatic bradycardia - starting treatment');
      setCurrentStep('bradycardia_symptomatic');
      setTimeout(() => setCurrentStep('give_atropine'), 1000);
    } else {
      addEvent('bradycardia', '✓ Asymptomatic bradycardia - monitor only');
    }
  }, [bradycardiaSymptoms, addEvent]);

  const handleGiveAtropine = useCallback(() => {
    if (atropineDoses >= 3) {
      addEvent('medication', 'Atropine max dose (3mg) reached');
      setCurrentStep('consider_pacing');
      setDueAction('pacing');
      return;
    }
    const newDose = atropineDoses + 1;
    setAtropineDoses(newDose);
    addEvent('medication', `Atropine 1.0mg IV (Dose ${newDose}/3, Total ${newDose}mg)`);
    setPendingOutcome(`Atropine Dose ${newDose}`);

    // Progression check for Megacode
    checkScenarioProgression('atropine');

    if (newDose >= 3) setDueAction('pacing');
  }, [atropineDoses, addEvent, checkScenarioProgression]);

  const handleAtropineIneffective = useCallback(() => {
    addEvent('bradycardia', 'Atropine ineffective - moving to pacing/infusion');
    setCurrentStep('consider_pacing');
    setDueAction('pacing');
  }, [addEvent]);

  const handleStartPacing = useCallback(() => {
    setPacingActive(true);
    addEvent('pacing', '⚡ Transcutaneous pacing started (60-80 bpm)');
    setDueAction(null);
    setPendingOutcome('Transcutaneous Pacing');
  }, [addEvent]);

  const handleStartInfusion = useCallback((type: 'dopamine' | 'epinephrine') => {
    setInfusionType(type);
    setInfusionRate(type === 'dopamine' ? 5 : 2);
    addEvent('infusion', `📈 ${type === 'dopamine' ? 'Dopamine' : 'Epinephrine'} infusion started`);
    setCurrentStep('bradycardia_infusion');
    setDueAction(null);
    setPendingOutcome(`${type === 'dopamine' ? 'Dopamine' : 'Epinephrine'} Infusion`);
  }, [addEvent]);

  // Tachyarrhythmia handlers
  const handleTachyUnstableCheck = useCallback((signId: string, checked: boolean) => {
    setTachyUnstableSigns(prev => ({ ...prev, [signId]: checked }));
  }, []);

  const handleTachyStabilityConfirm = useCallback(() => {
    const isUnstable = Object.values(tachyUnstableSigns).some(v => v);
    if (isUnstable) {
      addEvent('tachycardia', '🚨 UNSTABLE tachycardia - prepare for cardioversion');
      setCurrentStep('tachycardia_unstable');
      setDueAction('cardioversion');
    } else {
      addEvent('tachycardia', '✓ STABLE tachycardia - rate control');
      setCurrentStep('tachycardia_stable');
    }
  }, [tachyUnstableSigns, addEvent]);

  const handleCardioversion = useCallback(() => {
    const energy = getCardioversionEnergy();
    const newCount = cardioversionCount + 1;
    setCardioversionCount(newCount);
    addEvent('cardioversion', `⚡ Synchronized cardioversion: ${energy}J (Attempt ${newCount})`);
    setDueAction(null);
    setPendingOutcome(`Cardioversion ${energy}J (Attempt ${newCount})`);

    // Progression check for Megacode
    checkScenarioProgression('cardioversion');
  }, [getCardioversionEnergy, cardioversionCount, addEvent, checkScenarioProgression]);

  const handleVagalManeuver = useCallback(() => {
    setVagalAttempted(true);
    addEvent('tachycardia', '💨 Vagal maneuver attempted');
    setPendingOutcome('Vagal Maneuver');
  }, [addEvent]);

  const handleAdenosine = useCallback(() => {
    const doses = [6, 12, 12];
    const dose = doses[Math.min(adenosineDoses, 2)];
    const newCount = adenosineDoses + 1;
    setAdenosineDoses(newCount);
    addEvent('medication', `💊 Adenosine ${dose}mg rapid push (Attempt ${newCount})`);
    setPendingOutcome(`Adenosine ${dose}mg`);
    if (newCount >= 3) {
      addEvent('tachycardia', 'Adenosine max attempts reached - consider other options');
    }
  }, [adenosineDoses, addEvent]);

  // Cardiac arrest handlers
  const handleResumeCPR = useCallback(() => {
    startCPR();

    const isShockable = rhythmType === 'vf' || rhythmType === 'vt' || rhythmType === 'torsades';
    const timeSinceLastEpi = lastEpinephrineTime === 0 ? 0 : (Date.now() - lastEpinephrineTime);
    const epiIntervalExpired = lastEpinephrineTime === 0 || timeSinceLastEpi >= 180000;

    // Logic for Epinephrine:
    // 1. If it was already started in non-shockable path, stick to the 3-5 min timer regardless of rhythm shift.
    // 2. If starting fresh in shockable path, wait until after the 2nd shock.
    const shouldGiveEpinephrine = (epinephrineCount > 0 && epiIntervalExpired) || (epinephrineCount === 0 && shockCount >= 2);

    // Logic for Antiarrhythmics (Amiodarone/Lidocaine):
    // Only for shock-refractory VF/pVT after 3 shocks.
    const shouldGiveAmiodarone = isShockable && (shockCount === 3 || shockCount === 5);

    if (shouldGiveEpinephrine) {
      setDueAction('epinephrine');
      setCurrentStep('give_epinephrine');
    } else if (shouldGiveAmiodarone) {
      setDueAction('amiodarone');
      setCurrentStep('give_amiodarone');
    } else {
      setCurrentStep('wait_cpr_cycle');
    }
  }, [startCPR, shockCount, epinephrineCount, lastEpinephrineTime, rhythmType]);

  const handleGiveEpinephrine = useCallback(() => {
    const newEpiCount = epinephrineCount + 1;
    setEpinephrineCount(newEpiCount);
    setLastEpinephrineTime(Date.now());
    addEvent('medication', `Epinephrine ${newEpiCount}mg IV/IO given`);
    setDueAction(null);

    // Progression check
    checkScenarioProgression('epinephrine');

    const isNonShockable = rhythmType === 'asystole' || rhythmType === 'pea';
    if (isNonShockable) {
      setCurrentStep('consider_cause');
    } else {
      if (!cprActive) startCPR();
      setCurrentStep('wait_cpr_cycle');
    }
  }, [epinephrineCount, shockCount, cprActive, startCPR, addEvent, rhythmType, checkScenarioProgression]);

  const handleGiveAmiodarone = useCallback(() => {
    const dose = shockCount === 5 ? '150mg' : '300mg';
    addEvent('medication', `Amiodarone ${dose} IV/IO given`);
    setDueAction(null);

    // Progression check
    checkScenarioProgression('amiodarone');

    if (!cprActive) startCPR();
    setCurrentStep('wait_cpr_cycle');
  }, [shockCount, cprActive, startCPR, addEvent, checkScenarioProgression]);

  const handleDeliverShock = useCallback(() => {
    const energy = getRecommendedEnergy();
    const newShockCount = shockCount + 1;
    setShockCount(newShockCount);
    addEvent('defibrillation', `Shock ${newShockCount} delivered: ${energy}J`);
    setDueAction(null);

    // Progression check
    checkScenarioProgression('shock');

    setCurrentStep('resume_cpr');
  }, [getRecommendedEnergy, shockCount, addEvent, checkScenarioProgression]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && dueAction === 'shock' && currentStep === 'shockable_rhythm' && flashOn) {
        e.preventDefault();
        handleDeliverShock();
      } else if (e.key.toLowerCase() === 'e' && dueAction === 'epinephrine' && currentStep === 'give_epinephrine') {
        e.preventDefault();
        handleGiveEpinephrine();
      } else if (e.key.toLowerCase() === 'a' && dueAction === 'amiodarone' && currentStep === 'give_amiodarone') {
        e.preventDefault();
        handleGiveAmiodarone();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dueAction, currentStep, flashOn, handleDeliverShock, handleGiveEpinephrine, handleGiveAmiodarone]);

  const handleROSCConfirm = useCallback(() => {
    setRoscAchieved(true);
    setCprActive(false);
    addEvent('rosc', '✅ ROSC Achieved!');
    setDueAction(null);
    setCurrentStep('rosc_achieved');
    setTimeout(() => setCurrentStep('post_rosc_care'), 2000);
  }, [addEvent]);

  const handleNoROSC = useCallback(() => {
    addEvent('rosc_check', 'No ROSC - Continue resuscitation');
    setDueAction(null);
    setRhythmType('unknown');
    setCurrentStep('rhythm_analysis');
  }, [addEvent]);

  const handleNonShockablePath = useCallback(() => {
    addEvent('algorithm', 'Non-shockable rhythm - Continue CPR, identify causes');
    if (!cprActive) startCPR();
    const epiDue = lastEpinephrineTime === 0 || (Date.now() - lastEpinephrineTime) >= 180000;
    if (epiDue) {
      setDueAction('epinephrine');
      setCurrentStep('give_epinephrine');
    } else {
      setCurrentStep('consider_cause');
    }
  }, [lastEpinephrineTime, cprActive, startCPR, addEvent]);

  const handleCauseIdentified = useCallback((cause: string) => {
    addEvent('reversible_cause', `Checking for: ${cause}`);
  }, [addEvent]);

  const handleIntubation = useCallback(() => {
    if (!cprActive) return;
    setIsIntubated(true);
    addEvent('intubation', '🔧 Advanced airway placed - Continuous CPR with async ventilation');
    setCprPhase('compression');
    setBreathCount(0);
    setVentilationTimer(0);
  }, [cprActive, addEvent]);

  // Export event log
  const exportLog = useCallback(() => {
    const logData = {
      caseInfo: {
        startTime: caseStartTime?.toISOString(),
        totalDuration: elapsedTime,
        rhythmType: rhythmType,
        roscAchieved: roscAchieved
      },
      summary: {
        totalShocks: shockCount,
        totalEpinephrine: epinephrineCount,
        totalCprCycles: cprCycles,
        intubated: isIntubated
      },
      events: events.map(e => ({
        time: formatTimestamp(e.timestamp),
        type: e.type,
        note: e.note,
        details: e.details
      }))
    };

    const dataStr = JSON.stringify(logData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acls-event-log-${new Date().toISOString().split('T')[0]}-${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [caseStartTime, elapsedTime, rhythmType, roscAchieved, shockCount, epinephrineCount, cprCycles, isIntubated, events]);

  // Export as CSV
  const exportAsCSV = useCallback(() => {
    let csv = 'Timestamp,Type,Note\n';
    events.forEach(e => {
      // Escape quotes in note
      const note = e.note.replace(/"/g, '""');
      csv += `"${formatTimestamp(e.timestamp)}","${e.type}","${note}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acls-event-log-${new Date().toISOString().split('T')[0]}-${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  // Export as text report
  const exportAsText = useCallback(() => {
    let report = `ACLS EVENT LOG REPORT
=====================
Generated: ${new Date().toLocaleString()}
Case Start: ${caseStartTime?.toLocaleString() || 'N/A'}
Total Duration: ${formatTime(elapsedTime)}
Rhythm Type: ${rhythmType.toUpperCase()}
ROSC Achieved: ${roscAchieved ? 'Yes' : 'No'}

SUMMARY
-------
Total Shocks: ${shockCount}
Total Epinephrine: ${epinephrineCount}mg
CPR Cycles: ${cprCycles}
Intubated: ${isIntubated ? 'Yes' : 'No'}

EVENT TIMELINE
--------------
`;

    events.forEach(e => {
      report += `[${formatTimestamp(e.timestamp)}] ${e.type.toUpperCase()}: ${e.note}\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acls-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [caseStartTime, elapsedTime, rhythmType, roscAchieved, shockCount, epinephrineCount, cprCycles, isIntubated, events]);

  const printEvaluation = useCallback(() => {
    if (!evaluation) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const eventRows = events.map(e => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatTimestamp(e.timestamp)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${e.type.toUpperCase()}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${e.note}</td>
      </tr>
    `).join('');

    const criticalFailures = evaluation.criticalFailures.map(f => `<li style="color: #dc2626; margin-bottom: 4px;">${f}</li>`).join('');
    const feedback = evaluation.feedback.map(f => `<li style="margin-bottom: 4px;">${f}</li>`).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>ACLS Megacode Report - ${activeScenario?.name}</title>
          <style>
            body { font-family: sans-serif; line-height: 1.5; color: #333; padding: 40px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .score-box { text-align: center; margin: 30px 0; padding: 20px; border: 2px solid #333; border-radius: 8px; }
            .score { font-size: 48px; font-bold: true; margin: 10px 0; }
            .pass { color: #16a34a; } .fail { color: #dc2626; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .footer { margin-top: 50px; font-size: 10px; color: #777; text-align: center; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ACLS Megacode Evaluation Report</h1>
            <p><strong>Scenario:</strong> ${activeScenario?.name}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="score-box">
            <div class="score ${evaluation.passed ? 'pass' : 'fail'}">${evaluation.score}%</div>
            <div style="font-weight: bold; font-size: 20px;">RESULT: ${evaluation.passed ? 'PASSED' : 'FAILED'}</div>
          </div>

          <div class="section">
            <div class="section-title">Clinical Context</div>
            <p style="font-style: italic;">"${activeScenario?.description}"</p>
          </div>

          ${evaluation.criticalFailures.length > 0 ? `
            <div class="section">
              <div class="section-title" style="color: #dc2626;">Critical Failures</div>
              <ul>${criticalFailures}</ul>
            </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Performance Feedback</div>
            <ul>${feedback}</ul>
          </div>

          <div class="section">
            <div class="section-title">Case Summary</div>
            <p>Total Duration: ${formatTime(elapsedTime)}</p>
            <p>Total Shocks: ${shockCount}</p>
            <p>Epinephrine Given: ${epinephrineCount}mg</p>
            <p>CPR Cycles: ${cprCycles}</p>
          </div>

          <div class="section">
            <div class="section-title">Event Timeline</div>
            <table>
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="text-align: left; padding: 8px;">Time</th>
                  <th style="text-align: left; padding: 8px;">Type</th>
                  <th style="text-align: left; padding: 8px;">Note</th>
                </tr>
              </thead>
              <tbody>${eventRows}</tbody>
            </table>
          </div>

          <div class="footer">
            <p>This report was generated by the ACLS Algorithm Tool based on AHA 2025 Guidelines.</p>
            <p>Verification ID: ${crypto.randomUUID().split('-')[0].toUpperCase()}</p>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [evaluation, activeScenario, events, elapsedTime, shockCount, epinephrineCount, cprCycles]);

  const stepConfig = STEP_CONFIG[currentStep];
  const cprProgress = (cprCycleTime / 120) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <style>{cprAnimationStyles}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className={`h-8 w-8 ${caseActive ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">ACLS Algorithm Tool</h1>
                  <Link to="/history">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-blue-400 border border-blue-900/50 hover:bg-blue-900/20">
                      <History className="h-3 w-3 mr-1" /> HISTORY
                    </Button>
                  </Link>
                </div>
                <p className="text-xs text-slate-400">Guided Resuscitation • AHA 2025</p>
              </div>            </div>

            <div className="flex items-center gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className={`text-2xl font-mono font-bold ${caseActive ? 'text-green-400' : 'text-slate-500'}`}>
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                {!caseActive ? (
                  <div className="flex gap-2">
                    <Button onClick={startCase} className="bg-green-600 hover:bg-green-700">
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Start Case
                    </Button>

                    {SCENARIOS.map(scenario => (
                      <Button
                        key={scenario.id}
                        onClick={() => startMegacode(scenario.id)}
                        variant="outline"
                        className="border-purple-500 text-purple-400 hover:bg-purple-600/20"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        {scenario.name.split(':')[0]}
                      </Button>
                    ))}
                  </div>
                ) : (<AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Square className="h-4 w-4 mr-2" />
                      End Case
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">End Resuscitation Case?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This will stop the CPR timer and end the active scenario. You can still export the event log afterwards.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={endCase} className="bg-red-600 hover:bg-red-700 text-white">End Case</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Due Action Alert Banner */}
      {dueAction && caseActive && !roscAchieved && (
        <div
          ref={alertBannerRef}
          className={`sticky top-[73px] z-40 py-3 px-4 transition-all duration-200 ${flashOn ? 'bg-red-600 shadow-lg shadow-red-500/50' : 'bg-red-900/80'
            }`}
        >
          <div className="container mx-auto flex items-center justify-center gap-3">
            {dueAction === 'shock' && (
              <>
                <Zap className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  ⚡ DEFIBRILLATION DUE NOW - Deliver shock immediately! <span className="text-red-200 text-sm ml-2">[Press Space]</span>
                </span>
              </>
            )}
            {dueAction === 'epinephrine' && (
              <>
                <Syringe className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  💊 EPINEPHRINE DUE - Give 1mg IV/IO now! <span className="text-red-200 text-sm ml-2">[Press E]</span>
                </span>
              </>
            )}
            {dueAction === 'amiodarone' && (
              <>
                <Syringe className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  💊 AMIODARONE DUE - Give {shockCount === 5 ? '150mg' : '300mg'} IV/IO now! <span className="text-red-200 text-sm ml-2">[Press A]</span>
                </span>
              </>
            )}
            {dueAction === 'rosc_check' && (
              <>
                <CheckCircle className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  ✅ CHECK FOR ROSC - Stop CPR, check pulse and rhythm!
                </span>
              </>
            )}
            {dueAction === 'pacing' && (
              <>
                <Zap className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  ⚡ ATROPINE MAX - Begin pacing or infusion!
                </span>
              </>
            )}
            {dueAction === 'cardioversion' && (
              <>
                <Zap className="h-6 w-6 text-white animate-bounce" />
                <span className="text-white font-bold text-lg animate-pulse">
                  ⚡ UNSTABLE - Prepare synchronized cardioversion NOW!
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">

          {/* Left Panel - Current Step */}
          <div className="space-y-4">
            {/* Scenario Info (Megacode Mode Only) */}
            {isMegacodeMode && activeScenario && (
              <Card className="bg-purple-900/20 border-purple-500/50 shadow-lg shadow-purple-500/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-purple-300 text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5" /> {activeScenario.name}
                    </CardTitle>
                    <Badge variant="outline" className="border-purple-500 text-purple-400 animate-pulse">
                      EVALUATION MODE
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-200 text-sm italic">"{activeScenario.description}"</p>

                  {/* Instructor Overrides (Hidden in production or only for advanced users) */}
                  <div className="mt-4 pt-4 border-t border-purple-500/30">
                    <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2">Instructor Overrides (Force Rhythm Change)</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => forceRhythmChange('vf')} variant="outline" size="sm" className="text-[10px] h-7 border-red-500/50 text-red-400 hover:bg-red-500/10">FORCE VF</Button>
                      <Button onClick={() => forceRhythmChange('asystole')} variant="outline" size="sm" className="text-[10px] h-7 border-slate-500/50 text-slate-400 hover:bg-slate-500/10">FORCE ASYSTOLE</Button>
                      <Button onClick={() => forceRhythmChange('pea')} variant="outline" size="sm" className="text-[10px] h-7 border-blue-500/50 text-blue-400 hover:bg-blue-500/10">FORCE PEA</Button>
                      <Button onClick={() => forceRhythmChange('rosc')} variant="outline" size="sm" className="text-[10px] h-7 border-green-500/50 text-green-400 hover:bg-green-500/10">FORCE ROSC</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div ref={currentStepRef}>
              <Card className={`border-2 ${stepConfig?.priority === 'critical'
                ? 'bg-red-900/30 border-red-500'
                : stepConfig?.priority === 'high'
                  ? 'bg-orange-900/20 border-orange-500'
                  : 'bg-slate-800 border-slate-700'
                }`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">{stepConfig?.title}</CardTitle>
                  <CardDescription className="text-slate-300">{stepConfig?.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!roscAchieved && caseActive && (
                    <div className="space-y-3">

                      {/* Initial Presentation */}
                      {currentStep === 'initial_presentation' && (
                        <div className="space-y-4">
                          <p className="text-slate-300 text-sm text-center">Select patient status:</p>
                          <div className="grid grid-cols-1 gap-3">
                            <Button onClick={handlePatientUnresponsive} className="w-full bg-red-600 hover:bg-red-700 h-auto py-4" size="lg">
                              <div className="flex items-start gap-3 w-full">
                                <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold text-lg">🚨 Cardiac Arrest</span>
                                  <p className="text-red-200 text-sm">Unresponsive • No pulse • Not breathing</p>
                                </div>
                              </div>
                            </Button>

                            <Button
                              onClick={() => {
                                addEvent('presentation', 'Symptomatic Bradycardia');
                                setIsPulsePresent(true);
                                setRhythmType('bradycardia');
                                setCurrentStep('bradycardia_assessment');
                                setBradycardiaSymptoms({});
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 h-auto py-4"
                              size="lg"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <Activity className="h-6 w-6 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold text-lg">💓 Symptomatic Bradycardia</span>
                                  <p className="text-blue-200 text-sm">HR &lt; 60 • Dizziness • Syncope • Hypotension</p>
                                </div>
                              </div>
                            </Button>

                            <Button
                              onClick={() => {
                                addEvent('presentation', 'Symptomatic Tachycardia');
                                setIsPulsePresent(true);
                                setCurrentStep('tachycardia_assessment');
                              }}
                              className="w-full bg-orange-600 hover:bg-orange-700 h-auto py-4"
                              size="lg"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <Zap className="h-6 w-6 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold text-lg">⚡ Symptomatic Tachycardia</span>
                                  <p className="text-orange-200 text-sm">HR &gt; 150 • Chest pain • Shortness of breath</p>
                                </div>
                              </div>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Cardiac Arrest Steps */}
                      {currentStep === 'check_responsiveness' && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button onClick={handlePatientUnresponsive} className="bg-red-600 hover:bg-red-700" size="lg">
                            <AlertTriangle className="h-5 w-5 mr-2" />Unresponsive
                          </Button>
                          <Button onClick={() => { setIsPulsePresent(true); setCurrentStep('attach_monitor'); }} className="bg-green-600 hover:bg-green-700" size="lg">
                            <CheckCircle className="h-5 w-5 mr-2" />Responsive
                          </Button>
                        </div>
                      )}

                      {currentStep === 'call_for_help' && (
                        <Button onClick={handleHelpCalled} className="w-full bg-orange-600 hover:bg-orange-700" size="lg">
                          <Phone className="h-5 w-5 mr-2" />Help Called • Get AED<ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      )}

                      {currentStep === 'check_pulse_breathing' && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button onClick={handleNoPulse} className="bg-red-600 hover:bg-red-700" size="lg">
                            <AlertCircle className="h-5 w-5 mr-2" />No Pulse
                          </Button>
                          <Button onClick={handleHasPulse} className="bg-green-600 hover:bg-green-700" size="lg">
                            <CheckCircle className="h-5 w-5 mr-2" />Pulse Present
                          </Button>
                        </div>
                      )}

                      {currentStep === 'start_cpr' && (
                        <Button onClick={handleCPRStarted} className="w-full bg-red-600 hover:bg-red-700 animate-pulse" size="lg">
                          <Heart className="h-5 w-5 mr-2" />START CPR NOW<ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      )}

                      {currentStep === 'attach_monitor' && (
                        <Button onClick={handleMonitorAttached} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                          <Monitor className="h-5 w-5 mr-2" />Monitor Attached<ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      )}

                      {currentStep === 'rhythm_analysis' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-white font-bold text-lg">
                              {isMegacodeMode ? "🔍 Assessment: Identify Rhythm" : "📊 Select Rhythm:"}
                            </Label>
                            {isMegacodeMode && (
                              <Badge variant="outline" className="border-purple-500 text-purple-400 animate-pulse">
                                EVALUATION ACTIVE
                              </Badge>
                            )}
                          </div>

                          {/* Cardiac Monitor View (Megacode Only) */}
                          {isMegacodeMode && activeScenario && (
                            <div className="bg-black border-4 border-slate-700 rounded-xl p-4 shadow-inner">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-green-500 font-mono text-xs">LEAD II • 25mm/s</span>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setUseLiveECG(!useLiveECG)}
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-500 text-slate-400 hover:bg-slate-500/20 text-xs px-2 h-7 hover:text-white"
                                  >
                                    SWITCH TO {useLiveECG ? 'IMAGE' : 'LIVE'}
                                  </Button>
                                  <span className="text-slate-500 font-mono text-[10px]">MONITOR ACTIVE</span>
                                </div>
                              </div>

                              <div className="relative h-32 bg-slate-900/50 rounded border border-slate-800 overflow-hidden flex items-center justify-center">
                                {/* Grid Lines */}
                                <div className="absolute inset-0 opacity-10"
                                  style={{ backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                {useLiveECG ? (
                                  <DynamicECG rhythm={activeScenario.currentRhythm} speed={ecgSpeed} />
                                ) : (
                                  activeScenario.currentRhythm && (
                                    <img
                                      src={SCENARIOS.find(s => s.id === activeScenario.id)?.steps[activeScenario.currentStepIndex]?.ecgImage || activeScenario.ecgImage}
                                      alt="Cardiac Rhythm"
                                      className="h-full w-auto object-contain relative z-10 brightness-125 contrast-125"
                                      onError={(e) => {
                                        (e.target as any).style.display = 'none';
                                        (e.target as any).parentElement.innerHTML += '<div class="text-green-500 font-mono animate-pulse">IMAGE NOT FOUND<br/>SWITCH TO LIVE</div>';
                                      }}
                                    />
                                  )
                                )}
                              </div>
                              <p className="text-slate-400 text-[10px] mt-2 text-center italic">Look at the monitor carefully before selecting the rhythm.</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => handleRhythmSelect('vf')} variant="outline" className="border-red-500 text-red-400 hover:bg-red-600/20 justify-start">
                              <Zap className="h-4 w-4 mr-2" />VF
                            </Button>
                            <Button onClick={() => handleRhythmSelect('vt')} variant="outline" className="border-red-500 text-red-400 hover:bg-red-600/20 justify-start">
                              <Zap className="h-4 w-4 mr-2" />VT
                            </Button>
                            <Button onClick={() => handleRhythmSelect('asystole')} variant="outline" className="border-slate-500 text-slate-300 hover:bg-slate-600/20 justify-start">Asystole</Button>
                            <Button onClick={() => handleRhythmSelect('pea')} variant="outline" className="border-slate-500 text-slate-300 hover:bg-slate-600/20 justify-start">PEA</Button>
                            <Button onClick={() => handleRhythmSelect('torsades')} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">
                              <Zap className="h-4 w-4 mr-2" />Torsades
                            </Button>
                            <Button onClick={() => handleRhythmSelect('bradycardia')} variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-600/20 justify-start">Bradycardia</Button>
                            <Button onClick={() => handleRhythmSelect('svt')} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">SVT</Button>
                            <Button onClick={() => handleRhythmSelect('a_fib')} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">A-Fib</Button>
                          </div>
                        </div>
                      )}

                      {currentStep === 'shockable_rhythm' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-slate-700/50">
                            <p className="text-white text-sm">Recommended: <span className="font-bold text-yellow-400">{getRecommendedEnergy()}J</span> (Biphasic)</p>
                          </div>
                          <Button onClick={handleDeliverShock} className={`w-full ${dueAction === 'shock' && flashOn ? 'bg-red-500 scale-105 shadow-lg shadow-red-500/50' : 'bg-red-600 hover:bg-red-700'} ${dueAction === 'shock' ? 'animate-pulse' : ''}`} size="lg">
                            <Zap className="h-5 w-5 mr-2" />DELIVER SHOCK {shockCount + 1}
                          </Button>
                        </div>
                      )}

                      {currentStep === 'non_shockable_rhythm' && (
                        <Button onClick={handleNonShockablePath} className="w-full bg-slate-600 hover:bg-slate-700" size="lg">
                          <Heart className="h-5 w-5 mr-2" />Continue CPR<ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      )}

                      {currentStep === 'resume_cpr' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-orange-600/20 border border-orange-500">
                            <p className="text-orange-300 font-bold text-center">⚡ Shock {shockCount} Delivered!</p>
                            <p className="text-white text-sm text-center mt-1">Resume CPR immediately for 2 minutes</p>
                          </div>
                          <Button onClick={handleResumeCPR} className="w-full bg-orange-600 hover:bg-orange-700 animate-pulse" size="lg">
                            <Heart className="h-5 w-5 mr-2" />Resume CPR Immediately<ArrowRight className="h-5 w-5 ml-2" />
                          </Button>
                        </div>
                      )}

                      {currentStep === 'give_epinephrine' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-purple-600/20 border border-purple-500/50">
                            <p className="text-purple-300 text-sm font-semibold">Epinephrine #{epinephrineCount + 1}</p>
                            <p className="text-white text-sm">1mg IV/IO push, flush with 20mL NS</p>
                            <p className="text-slate-400 text-xs mt-1">Give every 3-5 minutes during cardiac arrest</p>
                          </div>
                          <Button onClick={handleGiveEpinephrine} className={`w-full ${dueAction === 'epinephrine' && flashOn ? 'bg-purple-500 scale-105' : 'bg-purple-600 hover:bg-purple-700'}`} size="lg">
                            <Syringe className="h-5 w-5 mr-2" />Epinephrine Given<ArrowRight className="h-5 w-5 ml-2" />
                          </Button>
                          <div className="p-2 rounded bg-slate-700/50 text-xs text-slate-400 text-center">
                            <p>Next: Resume CPR → 2 min cycle → Rhythm check</p>
                          </div>
                        </div>
                      )}

                      {currentStep === 'give_amiodarone' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-purple-600/20 border border-purple-500/50">
                            <p className="text-purple-300 text-sm font-semibold">Amiodarone {shockCount === 5 ? '(2nd dose)' : '(1st dose)'}</p>
                            <p className="text-white text-sm">{shockCount === 5 ? '150mg' : '300mg'} IV/IO push</p>
                            <p className="text-slate-400 text-xs mt-1">For refractory VF/pVT after 3 shocks</p>
                          </div>
                          <Button onClick={handleGiveAmiodarone} className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                            <Syringe className="h-5 w-5 mr-2" />Amiodarone {shockCount === 5 ? '150mg' : '300mg'} Given<ArrowRight className="h-5 w-5 ml-2" />
                          </Button>
                          <div className="p-2 rounded bg-slate-700/50 text-xs text-slate-400 text-center">
                            <p>Next: Resume CPR → 2 min cycle → Rhythm check</p>
                          </div>
                        </div>
                      )}

                      {currentStep === 'check_rosc' && (
                        <div className="space-y-3">
                          <p className="text-white text-center">Is there Return of Spontaneous Circulation?</p>
                          <div className="grid grid-cols-2 gap-3">
                            <Button onClick={handleNoROSC} variant="outline" className="border-red-500 text-red-400 hover:bg-red-600/20" size="lg">
                              <AlertCircle className="h-5 w-5 mr-2" />No ROSC
                            </Button>
                            <Button onClick={handleROSCConfirm} className="bg-green-600 hover:bg-green-700" size="lg">
                              <CheckCircle className="h-5 w-5 mr-2" />ROSC!
                            </Button>
                          </div>
                        </div>
                      )}

                      {currentStep === 'wait_cpr_cycle' && (
                        <div className="space-y-3">
                          <div className="text-center">
                            <p className="text-white mb-2 font-semibold">CPR in Progress</p>
                            <p className="text-4xl font-mono font-bold text-orange-400">{formatTime(cprCycleTime)}</p>
                            <p className="text-slate-400 text-sm">/ 2:00 cycle</p>
                            <Progress value={cprProgress} className="h-3 mt-3" />
                          </div>
                          <div className="p-2 rounded bg-slate-700/50 text-xs text-slate-400 text-center">
                            <p>After 2 min: Rhythm check → {rhythmType === 'asystole' || rhythmType === 'pea' ? 'Epinephrine if due → H\'s & T\'s' : 'Shock if shockable'}</p>
                          </div>
                        </div>
                      )}

                      {currentStep === 'consider_cause' && (
                        <div className="space-y-2">
                          <Label className="text-white font-semibold">Check Reversible Causes:</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {REVERSIBLE_CAUSES.slice(0, 6).map((cause, i) => (
                              <Button key={i} onClick={() => handleCauseIdentified(cause.label)} variant="outline" size="sm" className="border-orange-500/50 text-orange-300 hover:bg-orange-600/20 justify-start">
                                <cause.icon className="h-4 w-4 mr-2 shrink-0" />
                                <span className="text-xs truncate">{cause.label}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* BRADYCARDIA ALGORITHM */}
                      {currentStep === 'bradycardia_assessment' && (
                        <div className="space-y-3">
                          <Label className="text-white font-semibold">Check for Signs of Poor Perfusion:</Label>
                          <div className="space-y-2">
                            {BRADYCARDIA_SYMPTOMS.map((symptom) => (
                              <div
                                key={symptom.id}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${bradycardiaSymptoms[symptom.id]
                                  ? 'bg-red-600/30 border border-red-500'
                                  : symptom.critical
                                    ? 'bg-slate-700/50 border border-slate-600 hover:border-red-400'
                                    : 'bg-slate-700/30 border border-slate-600 hover:border-slate-500'
                                  }`}
                                onClick={() => handleSymptomCheck(symptom.id, !bradycardiaSymptoms[symptom.id])}
                              >
                                <Checkbox checked={bradycardiaSymptoms[symptom.id] || false} onCheckedChange={(checked) => handleSymptomCheck(symptom.id, checked as boolean)} />
                                <span className={`text-sm ${bradycardiaSymptoms[symptom.id] ? 'text-red-300 font-semibold' : 'text-slate-300'}`}>
                                  {symptom.label}
                                </span>
                                {symptom.critical && !bradycardiaSymptoms[symptom.id] && (
                                  <Badge variant="outline" className="border-red-500 text-red-400 text-xs ml-auto">Critical</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          <Button onClick={handleSymptomsConfirmed} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                            <ArrowRight className="h-5 w-5 mr-2" />
                            {Object.values(bradycardiaSymptoms).some(v => v) ? 'Symptomatic - Begin Treatment' : 'Asymptomatic - Monitor'}
                          </Button>
                        </div>
                      )}

                      {currentStep === 'give_atropine' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-blue-600/20 border border-blue-500/50">
                            <div className="flex items-center justify-between">
                              <p className="text-blue-300 text-sm font-semibold">Atropine Dose</p>
                              <Badge className="bg-blue-600">{atropineDoses}/6 doses</Badge>
                            </div>
                            <p className="text-white text-sm mt-1">0.5mg IV every 3-5 minutes</p>
                            <p className="text-slate-400 text-xs mt-1">Total: {(atropineDoses * 0.5).toFixed(1)}mg / 3mg max</p>
                          </div>

                          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${atropineDoses >= 6 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${(atropineDoses / 6) * 100}%` }} />
                          </div>

                          {atropineDoses < 6 ? (
                            <>
                              <Button onClick={handleGiveAtropine} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                                <Syringe className="h-5 w-5 mr-2" />Atropine 0.5mg Given
                              </Button>
                              <Button onClick={handleAtropineIneffective} variant="outline" className="w-full border-orange-500 text-orange-400 hover:bg-orange-600/20" size="lg">
                                Atropine Ineffective / Mobitz II or 3rd Degree<ArrowRight className="h-5 w-5 ml-2" />
                              </Button>
                            </>
                          ) : (
                            <div className="space-y-3">
                              <div className="p-3 rounded bg-yellow-600/30 border border-yellow-500">
                                <p className="text-yellow-400 text-sm text-center font-bold mb-2">⚠️ MAX ATROPINE REACHED (3mg)</p>
                              </div>
                              <div className="p-3 rounded bg-green-600/20 border border-green-500">
                                <p className="text-green-400 text-sm font-semibold mb-2">Next Steps per ACLS:</p>
                                <div className="space-y-1 text-xs text-slate-300">
                                  <p>1. Transcutaneous Pacing (TCP)</p>
                                  <p>2. Dopamine infusion (2-20 mcg/kg/min)</p>
                                  <p>3. Epinephrine infusion (2-10 mcg/min)</p>
                                </div>
                              </div>
                              <Button onClick={() => { setCurrentStep('consider_pacing'); setDueAction('pacing'); }} className="w-full bg-yellow-600 hover:bg-yellow-700 animate-pulse" size="lg">
                                <ArrowRight className="h-5 w-5 mr-2" />Proceed to Pacing / Infusion
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {currentStep === 'consider_pacing' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-yellow-600/20 border border-yellow-500/50">
                            <p className="text-yellow-300 text-sm font-semibold">⚠️ Atropine Ineffective / Max Dose</p>
                            <p className="text-slate-300 text-xs mt-1">Select next intervention:</p>
                          </div>

                          <div className="space-y-2">
                            <Button onClick={handleStartPacing} className={`w-full h-auto py-3 justify-start ${pacingActive ? 'bg-green-600' : 'bg-yellow-600 hover:bg-yellow-700'}`} size="lg">
                              <div className="flex items-start gap-3 w-full">
                                <Zap className="h-5 w-5 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold">⚡ Transcutaneous Pacing</span>
                                  <p className="text-xs opacity-80">Rate: 60-80 bpm • May need sedation</p>
                                  {pacingActive && <span className="text-xs text-green-200">✓ Active</span>}
                                </div>
                              </div>
                            </Button>

                            <Button onClick={() => handleStartInfusion('dopamine')} variant="outline" className={`w-full h-auto py-3 justify-start border-green-500 ${infusionType === 'dopamine' ? 'bg-green-600/20 text-green-300' : 'text-green-400 hover:bg-green-600/20'}`} size="lg">
                              <div className="flex items-start gap-3 w-full">
                                <Droplets className="h-5 w-5 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold">Dopamine Infusion</span>
                                  <p className="text-xs opacity-70">2-20 mcg/kg/min • Titrate to response</p>
                                </div>
                              </div>
                            </Button>

                            <Button onClick={() => handleStartInfusion('epinephrine')} variant="outline" className={`w-full h-auto py-3 justify-start border-purple-500 ${infusionType === 'epinephrine' ? 'bg-purple-600/20 text-purple-300' : 'text-purple-400 hover:bg-purple-600/20'}`} size="lg">
                              <div className="flex items-start gap-3 w-full">
                                <Syringe className="h-5 w-5 mt-0.5 shrink-0" />
                                <div className="text-left">
                                  <span className="font-bold">Epinephrine Infusion</span>
                                  <p className="text-xs opacity-70">2-10 mcg/min • Titrate to response</p>
                                </div>
                              </div>
                            </Button>
                          </div>

                          {(pacingActive || infusionType) && (
                            <div className="p-2 rounded bg-green-600/20 border border-green-500/50">
                              <p className="text-green-400 text-sm text-center font-semibold">✓ Can combine Pacing + Infusion if needed</p>
                            </div>
                          )}

                          <div className="p-2 rounded bg-slate-700/50 text-xs text-slate-400">
                            <p>💡 <strong>Note:</strong> For Mobitz II or 3rd degree AV block, go directly to pacing</p>
                          </div>
                        </div>
                      )}

                      {currentStep === 'bradycardia_infusion' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-green-600/20 border border-green-500/50">
                            <p className="text-green-300 text-sm font-semibold">
                              {infusionType === 'dopamine' ? '📈 Dopamine Infusion Active' : '📈 Epinephrine Infusion Active'}
                            </p>
                            <p className="text-white text-sm mt-1">
                              {infusionType === 'dopamine' ? `Rate: ${infusionRate} mcg/kg/min (Range: 2-20)` : `Rate: ${infusionRate} mcg/min (Range: 2-10)`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button onClick={() => setInfusionRate(Math.max(2, infusionRate - 2))} variant="outline" size="sm" disabled={infusionRate <= 2}>-</Button>
                            <div className="flex-1 text-center">
                              <span className="text-lg font-bold text-white">{infusionRate}</span>
                              <span className="text-slate-400 text-sm"> {infusionType === 'dopamine' ? 'mcg/kg/min' : 'mcg/min'}</span>
                            </div>
                            <Button onClick={() => setInfusionRate(Math.min(infusionType === 'dopamine' ? 20 : 10, infusionRate + 2))} variant="outline" size="sm" disabled={infusionRate >= (infusionType === 'dopamine' ? 20 : 10)}>+</Button>
                          </div>

                          {pacingActive && (
                            <div className="p-2 rounded bg-green-600/20 border border-green-500/50">
                              <p className="text-green-400 text-sm text-center">✓ Pacing active + Infusion running</p>
                            </div>
                          )}

                          <Button onClick={() => setCurrentStep('consider_pacing')} variant="outline" className="w-full border-slate-500 text-slate-400" size="sm">
                            ← Back to Pacing/Infusion Options
                          </Button>
                        </div>
                      )}

                      {/* TACHYARRHYTHMIA ALGORITHM */}
                      {currentStep === 'tachycardia_assessment' && (
                        <div className="space-y-3">
                          <Label className="text-white font-semibold">Identify Tachycardia Rhythm:</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => { setTachyRhythm('svt'); setCurrentStep('tachycardia_unstable_check'); }} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">
                              SVT (Regular, Narrow)
                            </Button>
                            <Button onClick={() => { setTachyRhythm('a_fib'); setCurrentStep('tachycardia_unstable_check'); }} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">
                              Atrial Fibrillation
                            </Button>
                            <Button onClick={() => { setTachyRhythm('a_flutter'); setCurrentStep('tachycardia_unstable_check'); }} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">
                              Atrial Flutter
                            </Button>
                            <Button onClick={() => { setTachyRhythm('stable_vt'); setCurrentStep('tachycardia_unstable_check'); }} variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-600/20 justify-start">
                              VT (Monomorphic)
                            </Button>
                          </div>
                        </div>
                      )}

                      {currentStep === 'tachycardia_unstable_check' && (
                        <div className="space-y-3">
                          <Label className="text-white font-semibold">Check for Unstable Signs:</Label>
                          <div className="space-y-2">
                            {TACHYCARDIA_UNSTABLE_SIGNS.map((sign) => (
                              <div
                                key={sign.id}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${tachyUnstableSigns[sign.id]
                                  ? 'bg-red-600/30 border border-red-500'
                                  : 'bg-slate-700/50 border border-slate-600 hover:border-red-400'
                                  }`}
                                onClick={() => handleTachyUnstableCheck(sign.id, !tachyUnstableSigns[sign.id])}
                              >
                                <Checkbox checked={tachyUnstableSigns[sign.id] || false} onCheckedChange={(checked) => handleTachyUnstableCheck(sign.id, checked as boolean)} />
                                <span className={`text-sm ${tachyUnstableSigns[sign.id] ? 'text-red-300 font-semibold' : 'text-slate-300'}`}>
                                  {sign.label}
                                </span>
                                {sign.critical && !tachyUnstableSigns[sign.id] && (
                                  <Badge variant="outline" className="border-red-500 text-red-400 text-xs ml-auto">Critical</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          <Button onClick={handleTachyStabilityConfirm} className="w-full bg-orange-600 hover:bg-orange-700" size="lg">
                            <ArrowRight className="h-5 w-5 mr-2" />
                            {Object.values(tachyUnstableSigns).some(v => v) ? 'UNSTABLE - Prepare Cardioversion' : 'STABLE - Rate Control'}
                          </Button>
                        </div>
                      )}

                      {currentStep === 'tachycardia_unstable' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-red-600/30 border border-red-500">
                            <p className="text-red-300 text-sm font-bold">🚨 UNSTABLE TACHYCARDIA</p>
                            <p className="text-white text-sm">Synchronized cardioversion needed!</p>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-700/50">
                            <p className="text-white text-sm">Rhythm: <span className="font-bold text-orange-400">{tachyRhythm?.toUpperCase()}</span></p>
                            <p className="text-white text-sm">Energy: <span className="font-bold text-yellow-400">{getCardioversionEnergy()}J</span> (Synchronized)</p>
                            <p className="text-slate-400 text-xs mt-1">Cardioversion attempt #{cardioversionCount + 1}</p>
                          </div>

                          <Button onClick={handleCardioversion} className={`w-full ${dueAction === 'cardioversion' && flashOn ? 'bg-red-500 scale-105' : 'bg-red-600 hover:bg-red-700'} ${dueAction === 'cardioversion' ? 'animate-pulse' : ''}`} size="lg">
                            <Zap className="h-5 w-5 mr-2" />Deliver Cardioversion ({getCardioversionEnergy()}J)
                          </Button>

                          {cardioversionCount > 0 && cardioversionCount < 3 && (
                            <Button onClick={() => { setDueAction('cardioversion'); }} variant="outline" className="w-full border-orange-500 text-orange-400">
                              Increase Energy & Repeat ({cardioversionCount + 1}/3)
                            </Button>
                          )}
                        </div>
                      )}

                      {currentStep === 'tachycardia_stable' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-green-600/20 border border-green-500/50">
                            <p className="text-green-300 text-sm font-bold">✓ STABLE TACHYCARDIA</p>
                            <p className="text-white text-sm">Rate control or rhythm control options</p>
                          </div>

                          <div className="p-2 rounded bg-slate-700/50 text-xs text-slate-400">
                            <p>Rhythm: <strong className="text-white">{tachyRhythm?.toUpperCase()}</strong></p>
                          </div>

                          {tachyRhythm === 'svt' ? (
                            <div className="space-y-2">
                              <Button onClick={() => { setVagalAttempted(false); setAdenosineDoses(0); setCurrentStep('tachycardia_svt_vagal'); }} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                                💨 Vagal Maneuvers → Adenosine
                              </Button>
                              <p className="text-slate-400 text-xs text-center">SVT: Vagal maneuvers first, then Adenosine</p>
                            </div>
                          ) : tachyRhythm === 'a_fib' || tachyRhythm === 'a_flutter' ? (
                            <div className="space-y-2">
                              <Button onClick={() => addEvent('medication', '💊 Diltiazem 0.25mg/kg IV')} className="w-full bg-purple-600 hover:bg-purple-700 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Diltiazem (Rate Control)
                              </Button>
                              <Button onClick={() => addEvent('medication', '💊 Metoprolol 5mg IV')} className="w-full bg-purple-600 hover:bg-purple-700 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Metoprolol (Rate Control)
                              </Button>
                              <Button onClick={() => addEvent('medication', '💊 Amiodarone 150mg IV over 10min')} variant="outline" className="w-full border-purple-500 text-purple-400 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Amiodarone (Rhythm Control)
                              </Button>
                              <p className="text-slate-400 text-xs text-center">Consider anticoagulation for A-Fib/A-Flutter</p>
                            </div>
                          ) : tachyRhythm === 'stable_vt' ? (
                            <div className="space-y-2">
                              <Button onClick={() => addEvent('medication', '💊 Amiodarone 150mg IV over 10min')} className="w-full bg-purple-600 hover:bg-purple-700 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Amiodarone 150mg IV
                              </Button>
                              <Button onClick={() => addEvent('medication', '💊 Procainamide 20-50mg/min IV')} variant="outline" className="w-full border-purple-500 text-purple-400 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Procainamide (Alternative)
                              </Button>
                              <Button onClick={() => addEvent('medication', '💊 Sotalol 1.5mg/kg IV')} variant="outline" className="w-full border-purple-500 text-purple-400 justify-start">
                                <Syringe className="h-4 w-4 mr-2" />Sotalol (Alternative)
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {currentStep === 'tachycardia_svt_vagal' && (
                        <div className="space-y-3">
                          <Label className="text-white font-semibold">Vagal Maneuvers:</Label>
                          <div className="space-y-2 text-sm text-slate-300">
                            <p>1. Modified Valsalva: Blow into syringe for 15 sec, then lie flat with legs elevated</p>
                            <p>2. Carotid sinus massage (if no carotid bruit)</p>
                            <p>3. Cold water to face (diving reflex)</p>
                          </div>
                          <Button onClick={handleVagalManeuver} className={`w-full ${vagalAttempted ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`} size="lg">
                            {vagalAttempted ? '✓ Vagal Attempted' : '💨 Attempt Vagal Maneuver'}
                          </Button>
                          <Button onClick={() => setCurrentStep('tachycardia_svt_adenosine')} className="w-full bg-orange-600 hover:bg-orange-700" size="lg">
                            <ArrowRight className="h-5 w-5 mr-2" />Vagal Failed → Try Adenosine
                          </Button>
                        </div>
                      )}

                      {currentStep === 'tachycardia_svt_adenosine' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-purple-600/20 border border-purple-500/50">
                            <p className="text-purple-300 text-sm font-semibold">Adenosine Protocol:</p>
                            <p className="text-white text-sm">Rapid IV push with immediate flush!</p>
                            <div className="mt-2 space-y-1 text-sm">
                              <p className={adenosineDoses >= 1 ? 'text-green-400' : 'text-slate-300'}>1st dose: 6mg {adenosineDoses >= 1 ? '✓' : ''}</p>
                              <p className={adenosineDoses >= 2 ? 'text-green-400' : 'text-slate-300'}>2nd dose: 12mg {adenosineDoses >= 2 ? '✓' : ''}</p>
                              <p className={adenosineDoses >= 3 ? 'text-green-400' : 'text-slate-300'}>3rd dose: 12mg {adenosineDoses >= 3 ? '✓' : ''}</p>
                            </div>
                          </div>

                          {adenosineDoses < 3 ? (
                            <Button onClick={handleAdenosine} className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                              <Syringe className="h-5 w-5 mr-2" />
                              Adenosine {[6, 12, 12][adenosineDoses]}mg Rapid Push
                            </Button>
                          ) : (
                            <div className="p-3 rounded bg-yellow-600/30 border border-yellow-500">
                              <p className="text-yellow-400 text-sm text-center">⚠️ Max adenosine attempts reached</p>
                              <p className="text-yellow-200 text-xs text-center mt-1">Consider other rate control agents</p>
                            </div>
                          )}

                          <Button onClick={() => setCurrentStep('tachycardia_stable')} variant="outline" className="w-full border-slate-500 text-slate-400" size="sm">
                            ← Back to Rate Control Options
                          </Button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ROSC Achieved */}
                  {roscAchieved && currentStep === 'post_rosc_care' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-600/20 border border-green-500/50">
                        <p className="text-green-400 font-semibold">🎉 ROSC Achieved!</p>
                        <p className="text-white text-sm">Complete post-cardiac arrest care</p>
                      </div>
                      <div className="space-y-2 text-sm text-slate-300">
                        <p>• Airway: Secure, confirm placement</p>
                        <p>• Ventilation: SpO2 92-98%</p>
                        <p>• Hemodynamics: MAP &gt;65 mmHg</p>
                        <p>• 12-lead ECG</p>
                        <p>• Temperature management: 32-36°C</p>
                        <p>• Consider coronary angiography</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Algorithm Progress - Shows cardiac arrest protocol */}
            {!isArrhythmiaPathway && caseActive && !roscAchieved && (rhythmType === 'vf' || rhythmType === 'vt' || rhythmType === 'torsades' || rhythmType === 'asystole' || rhythmType === 'pea') && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">📋 Algorithm Progress</CardTitle>
                  <CardDescription className="text-slate-400">Current position in ACLS protocol</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {/* Shockable vs Non-Shockable header */}
                    <div className={`p-2 rounded font-semibold text-center ${(rhythmType === 'vf' || rhythmType === 'vt' || rhythmType === 'torsades') ? 'bg-red-600/30 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>
                      {(rhythmType === 'vf' || rhythmType === 'vt' || rhythmType === 'torsades') ? '⚡ SHOCKABLE RHYTHM PATHWAY' : '❌ NON-SHOCKABLE RHYTHM PATHWAY'}
                    </div>

                    {/* Progress steps */}
                    <div className="space-y-1 mt-2">
                      {rhythmType === 'vf' || rhythmType === 'vt' || rhythmType === 'torsades' ? (
                        // Shockable rhythm steps
                        <>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 1 ? 'bg-green-600/20 border-l-4 border-green-500' : shockCount === 0 && currentStep === 'shockable_rhythm' ? 'bg-yellow-600/20 border-l-4 border-yellow-500 animate-pulse' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 1 ? 'text-green-400' : 'text-slate-400'}>Shock 1</span>
                            {shockCount >= 1 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 2 ? 'bg-green-600/20 border-l-4 border-green-500' : shockCount === 1 ? 'bg-yellow-600/20 border-l-4 border-yellow-500 animate-pulse' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 2 ? 'text-green-400' : 'text-slate-400'}>CPR 2 min → Shock 2</span>
                            {shockCount >= 2 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${epinephrineCount >= 1 ? 'bg-green-600/20 border-l-4 border-green-500' : shockCount === 2 ? 'bg-purple-600/20 border-l-4 border-purple-500 animate-pulse' : 'bg-slate-700/30'}`}>
                            <span className={epinephrineCount >= 1 ? 'text-green-400' : 'text-slate-400'}>Epinephrine 1mg + CPR 2 min</span>
                            {epinephrineCount >= 1 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 3 ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 3 ? 'text-green-400' : 'text-slate-400'}>Shock 3</span>
                            {shockCount >= 3 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 3 && events.some(e => e.note.includes('Amiodarone 300mg')) ? 'bg-green-600/20 border-l-4 border-green-500' : shockCount === 3 ? 'bg-purple-600/20 border-l-4 border-purple-500 animate-pulse' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 3 && events.some(e => e.note.includes('Amiodarone 300mg')) ? 'text-green-400' : 'text-slate-400'}>Amiodarone 300mg</span>
                            {shockCount >= 3 && events.some(e => e.note.includes('Amiodarone 300mg')) && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 4 ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 4 ? 'text-green-400' : 'text-slate-400'}>CPR 2 min → Shock 4</span>
                            {shockCount >= 4 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${epinephrineCount >= 2 ? 'bg-green-600/20 border-l-4 border-green-500' : shockCount === 4 ? 'bg-purple-600/20 border-l-4 border-purple-500 animate-pulse' : 'bg-slate-700/30'}`}>
                            <span className={epinephrineCount >= 2 ? 'text-green-400' : 'text-slate-400'}>Epinephrine (q3-5min)</span>
                            {epinephrineCount >= 2 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${shockCount >= 5 ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-slate-700/30'}`}>
                            <span className={shockCount >= 5 ? 'text-green-400' : 'text-slate-400'}>Shock 5 + Amiodarone 150mg</span>
                            {shockCount >= 5 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className="p-2 rounded bg-slate-700/50 text-slate-400 text-xs text-center">
                            Continue: CPR 2 min → Rhythm check → Shock → Epi q3-5min
                          </div>
                        </>
                      ) : (
                        // Non-shockable rhythm steps
                        <>
                          <div className={`p-2 rounded flex items-center gap-2 ${cprActive ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-yellow-600/20 border-l-4 border-yellow-500 animate-pulse'}`}>
                            <span className={cprActive ? 'text-green-400' : 'text-slate-400'}>CPR 2 min cycle</span>
                            {cprActive && <Badge className="bg-orange-600 ml-auto">ACTIVE</Badge>}
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${epinephrineCount >= 1 ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-purple-600/20 border-l-4 border-purple-500 animate-pulse'}`}>
                            <span className={epinephrineCount >= 1 ? 'text-green-400' : 'text-slate-400'}>Epinephrine 1mg ASAP</span>
                            {epinephrineCount >= 1 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className="p-2 rounded bg-slate-600/30 border-l-4 border-orange-500">
                            <span className="text-orange-300">🔍 Identify H's & T's</span>
                          </div>
                          <div className={`p-2 rounded flex items-center gap-2 ${epinephrineCount >= 2 ? 'bg-green-600/20 border-l-4 border-green-500' : 'bg-slate-700/30'}`}>
                            <span className={epinephrineCount >= 2 ? 'text-green-400' : 'text-slate-400'}>Epinephrine q3-5min</span>
                            {epinephrineCount >= 2 && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
                          </div>
                          <div className="p-2 rounded bg-slate-700/50 text-slate-400 text-xs text-center">
                            Continue: CPR → Rhythm check → Epi q3-5min → Treat causes
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outcome Tracking - Shows after intervention */}
            {pendingOutcome && (
              <Card className="bg-slate-800 border-yellow-500 animate-pulse">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">📝 Record Outcome</CardTitle>
                  <CardDescription className="text-yellow-300">
                    Did patient stabilize after: <strong>{pendingOutcome}</strong>?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => recordOutcome(pendingOutcome, 'stabilized')}
                      className="bg-green-600 hover:bg-green-700 h-auto py-4"
                      size="lg"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle className="h-6 w-6" />
                        <span className="font-bold">STABILIZED</span>
                        <span className="text-xs opacity-80">Patient improved</span>
                      </div>
                    </Button>
                    <Button
                      onClick={() => recordOutcome(pendingOutcome, 'not_stabilized')}
                      className="bg-red-600 hover:bg-red-700 h-auto py-4"
                      size="lg"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <AlertCircle className="h-6 w-6" />
                        <span className="font-bold">NOT STABILIZED</span>
                        <span className="text-xs opacity-80">Continue treatment</span>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CPR Timer Card - Hidden during arrhythmia pathways */}
            {cprActive && !isArrhythmiaPathway && !roscAchieved && (
              <Card className={`border-2 transition-colors duration-500 ${cprCycleTime >= 110 ? 'bg-red-900/30 border-red-500 animate-pulse' : 'bg-slate-800 border-orange-500'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">💓 CPR Timer</CardTitle>
                    <Badge className="bg-orange-600 animate-pulse">ACTIVE</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-slate-400 text-sm">Cycle Time</p>
                    <p className={`text-4xl font-mono font-bold transition-colors ${cprCycleTime >= 110 ? 'text-red-400' : 'text-orange-400'}`}>{formatTime(cprCycleTime)}</p>
                    <p className="text-slate-400 text-sm">/ 2:00</p>
                    <Progress value={cprProgress} className={`h-2 mt-2 ${cprCycleTime >= 110 ? '[&>div]:bg-red-500' : '[&>div]:bg-orange-500'}`} />
                    {cprCycleTime >= 110 && (
                      <p className="text-red-400 font-bold text-sm mt-2 animate-bounce">PREPARE FOR RHYTHM CHECK</p>
                    )}
                  </div>

                  {/* Epi Timer */}
                  {(rhythmType === 'asystole' || rhythmType === 'pea' || shockCount > 0) && (
                    <div className="mb-4 flex flex-col items-center p-2 rounded bg-slate-700/50 border border-slate-600">
                      <p className="text-slate-400 text-xs">Time Since Last Epi</p>
                      <p className={`text-xl font-mono font-bold ${lastEpinephrineTime === 0 ? 'text-slate-500' : (Date.now() - lastEpinephrineTime) >= 180000 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                        {lastEpinephrineTime === 0 ? 'Not Given' : formatTime(Math.floor((Date.now() - lastEpinephrineTime) / 1000))}
                      </p>
                      {(Date.now() - lastEpinephrineTime) >= 180000 && lastEpinephrineTime !== 0 && (
                        <p className="text-red-400 text-xs font-bold mt-1">DUE NOW</p>
                      )}
                    </div>
                  )}

                  {/* Compression rate slider */}
                  <div className="mb-4">
                    <Label className="text-slate-300 text-xs">Compression Rate: {compressionRate}/min</Label>
                    <Slider value={[compressionRate]} onValueChange={([v]) => setCompressionRate(v)} min={100} max={120} step={5} className="mt-1" />
                  </div>

                  {/* Audio Controls */}
                  <div className="mb-4 space-y-2 relative">
                    <div className="flex items-center justify-between bg-slate-700/30 p-2 rounded-lg border border-slate-700">
                      <div className="flex flex-col">
                        <Label className="text-slate-300 text-sm font-semibold">Audio Metronome</Label>
                        <span className="text-slate-500 text-xs">{compressionRate} BPM Beeps</span>
                      </div>
                      <Switch
                        checked={metronomeEnabled}
                        onCheckedChange={setMetronomeEnabled}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2 bg-slate-700/30 p-2 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <Label className="text-slate-300 text-sm font-semibold">Monitor Sweep Speed</Label>
                            <span className="text-slate-500 text-xs">Waveform velocity control</span>
                          </div>
                          <span className="text-blue-400 font-mono text-xs font-bold">{(ecgSpeed * 41.6).toFixed(1)} mm/s</span>
                        </div>
                        <Slider
                          value={[ecgSpeed]}
                          onValueChange={(val) => setEcgSpeed(val[0])}
                          min={0.2}
                          max={1.5}
                          step={0.1}
                          className="py-2"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono uppercase">
                          <span>12.5 mm/s</span>
                          <span>25 mm/s</span>
                          <span>50 mm/s</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-slate-700/30 p-2 rounded-lg border border-slate-700">
                        <div className="flex flex-col">
                          <Label className="text-slate-300 text-sm font-semibold">Voice Language</Label>
                          <span className="text-slate-500 text-xs">Prompt language selection</span>
                        </div>
                        <select
                          value={voiceLanguage}
                          onChange={(e) => setVoiceLanguage(e.target.value as any)}
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिन्दी (Hindi)</option>
                          <option value="mr">मराठी (Marathi)</option>
                          <option value="ta">தமிழ் (Tamil)</option>
                          <option value="te">తెలుగు (Telugu)</option>
                          <option value="bn">বাংলা (Bengali)</option>
                          <option value="kn">ಕನ್ನಡ (Kannada)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between bg-slate-700/30 p-2 rounded-lg border border-slate-700">
                        <div className="flex flex-col">
                          <Label className="text-slate-300 text-sm font-semibold">Voice Prompts</Label>
                          <span className="text-slate-500 text-xs">Audio cues for critical actions</span>
                        </div>
                        <Switch
                          checked={voicePromptsEnabled}
                          onCheckedChange={setVoicePromptsEnabled}
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Intubation button */}
                  {!isIntubated ? (
                    <Button onClick={handleIntubation} className="w-full bg-blue-600 hover:bg-blue-700" size="sm">
                      🔧 Intubated → Continuous CPR
                    </Button>
                  ) : (
                    <div className="p-2 rounded bg-green-600/20 border border-green-500 text-center">
                      <p className="text-green-400 text-sm">✓ Intubated - Continuous CPR</p>
                      <p className="text-slate-400 text-xs">Async ventilation: 10 breaths/min</p>
                      <p className="text-slate-400 text-xs">Next breath in: {6 - ventilationTimer}s</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Panel - CPR Visual Guide (Hidden during arrhythmias) */}
          <div className="space-y-4">
            {cprActive && !isArrhythmiaPathway && !roscAchieved && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white">CPR Visual Guide</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Heart and Lungs Animation */}
                  <div className="relative h-48 flex items-center justify-center">
                    {/* Lungs */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-8">
                      <div
                        className={`w-16 h-20 rounded-full ${(isIntubated && ventilationTimer >= 5) || (!isIntubated && cprPhase === 'ventilation')
                          ? 'bg-blue-400/50'
                          : 'bg-blue-900/30'
                          }`}
                        style={{
                          animation: (isIntubated && ventilationTimer >= 5) || (!isIntubated && cprPhase === 'ventilation')
                            ? 'lungExpand 2s ease-in-out infinite'
                            : 'none'
                        }}
                      />
                      <div
                        className={`w-16 h-20 rounded-full ${(isIntubated && ventilationTimer >= 5) || (!isIntubated && cprPhase === 'ventilation')
                          ? 'bg-blue-400/50'
                          : 'bg-blue-900/30'
                          }`}
                        style={{
                          animation: (isIntubated && ventilationTimer >= 5) || (!isIntubated && cprPhase === 'ventilation')
                            ? 'lungExpand 2s ease-in-out infinite'
                            : 'none'
                        }}
                      />
                    </div>

                    {/* Heart */}
                    <div
                      className="absolute w-20 h-20 bg-red-500 rounded-full flex items-center justify-center"
                      style={{
                        animation: cprPhase === 'compression' || isIntubated
                          ? 'heartSqueeze 0.55s ease-in-out infinite'
                          : 'none'
                      }}
                    >
                      <Heart className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  {/* Phase Indicator */}
                  <div className="mt-4 text-center">
                    {isIntubated ? (
                      <div className="space-y-2">
                        <p className="text-2xl font-bold text-white">Continuous Compressions</p>
                        <p className="text-lg text-slate-400">Count: {compressionCount + 1}</p>
                        <p className="text-sm text-blue-400">Async ventilation every 6s</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className={`text-2xl font-bold ${cprPhase === 'compression' ? 'text-red-400' : 'text-blue-400'}`}>
                          {cprPhase === 'compression' ? '💪 COMPRESSIONS' : '💨 VENTILATION'}
                        </p>
                        {cprPhase === 'compression' ? (
                          <p className="text-4xl font-mono text-white">{compressionCount + 1} / 30</p>
                        ) : (
                          <p className="text-4xl font-mono text-white">{breathCount + 1} / 2</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CPR Stats */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded bg-slate-700/50">
                      <p className="text-slate-400 text-xs">Shocks</p>
                      <p className="text-xl font-bold text-white">{shockCount}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-700/50">
                      <p className="text-slate-400 text-xs">Epinephrine</p>
                      <p className="text-xl font-bold text-white">{epinephrineCount}mg</p>
                    </div>
                    <div className="p-2 rounded bg-slate-700/50">
                      <p className="text-slate-400 text-xs">CPR Cycles</p>
                      <p className="text-xl font-bold text-white">{cprCycles}</p>
                    </div>
                    <div className="p-2 rounded bg-slate-700/50">
                      <p className="text-slate-400 text-xs">Rhythm</p>
                      <p className="text-lg font-bold text-orange-400">{rhythmType.toUpperCase()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Megacode Evaluation Report */}
            {evaluation && (
              <Card className={`mb-6 border-2 ${evaluation.passed ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl text-white">Megacode Evaluation</CardTitle>
                      <CardDescription className="text-slate-400">AHA 2025 Performance Report</CardDescription>
                      <Button
                        onClick={printEvaluation}
                        variant="outline"
                        size="sm"
                        className="mt-2 border-purple-500 text-purple-400 hover:bg-purple-600/20"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Print Report (PDF)
                      </Button>
                    </div>
                    <div className="text-right">
                      <div className={`text-4xl font-bold ${evaluation.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {evaluation.score}%
                      </div>
                      <Badge variant={evaluation.passed ? "default" : "destructive"} className={evaluation.passed ? "bg-green-600" : ""}>
                        {evaluation.passed ? "PASS" : "FAIL"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {evaluation.criticalFailures.length > 0 && (
                    <div className="bg-red-950/40 p-3 rounded-lg border border-red-500/50">
                      <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" /> Critical Failures
                      </h4>
                      <ul className="list-disc list-inside text-red-200 text-sm space-y-1">
                        {evaluation.criticalFailures.map((fail, i) => <li key={i}>{fail}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700">
                    <h4 className="text-slate-200 font-bold mb-2">Performance Feedback</h4>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {evaluation.feedback.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Event Log */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">📋 Event Log</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={exportAsText}
                      variant="outline"
                      size="sm"
                      className="border-green-600 text-green-400 hover:bg-green-600/20 px-2"
                      disabled={events.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-1 hidden sm:block" />
                      TXT
                    </Button>
                    <Button
                      onClick={exportAsCSV}
                      variant="outline"
                      size="sm"
                      className="border-blue-600 text-blue-400 hover:bg-blue-600/20 px-2"
                      disabled={events.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1 hidden sm:block" />
                      CSV
                    </Button>
                    <Button
                      onClick={exportLog}
                      variant="outline"
                      size="sm"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600/20 px-2"
                      disabled={events.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1 hidden sm:block" />
                      JSON
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-slate-600 text-slate-400">
                          Clear
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Clear All Data?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This will completely erase the event log, timer, and all case data. This action cannot be undone. Are you sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={clearAll} className="bg-red-600 hover:bg-red-700 text-white">Clear All</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {events.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center">No events recorded</p>
                  ) : (
                    events.slice().reverse().map(event => (
                      <div key={event.id} className={`p-2 rounded text-sm ${event.type === 'outcome'
                        ? event.note.includes('Stabilized')
                          ? 'bg-green-600/20 border border-green-500/50'
                          : 'bg-red-600/20 border border-red-500/50'
                        : 'bg-slate-700/50'
                        }`}>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-xs ${event.type === 'outcome'
                            ? event.note.includes('Stabilized')
                              ? 'border-green-500 text-green-400'
                              : 'border-red-500 text-red-400'
                            : 'border-slate-500 text-slate-400'
                            }`}>{event.type}</Badge>
                          <span className="text-slate-500 text-xs">{formatTimestamp(event.timestamp)}</span>
                        </div>
                        <p className={`mt-1 ${event.type === 'outcome' ? 'font-semibold' : 'text-white'}`}>{event.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-700 bg-slate-900/95 py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">ACLS Algorithm Tool • Based on AHA 2025 Guidelines</p>
        </div>
      </footer>
    </div>
  );
}
