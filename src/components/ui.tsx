// Minimal self-contained UI components — no external component library needed

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export function Button({
  variant = 'primary', className = '', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-nhs-blue text-white hover:bg-nhs-dark-blue',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost:   'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    danger:  'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${className}`}
      {...props}
    />
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-500">{icon}</span>}
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'grey';

export function Badge({ variant = 'default', children }: { variant?: BadgeVariant; children: ReactNode }) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-gray-100 text-gray-700',
    green:   'bg-green-100 text-green-800',
    yellow:  'bg-yellow-100 text-yellow-800',
    orange:  'bg-orange-100 text-orange-800',
    red:     'bg-red-100 text-red-800',
    blue:    'bg-blue-100 text-blue-800',
    grey:    'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${variants[variant]}`}>
      {children}
    </span>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export function Alert({ variant = 'info', title, children }: { variant?: AlertVariant; title?: string; children: ReactNode }) {
  const variants: Record<AlertVariant, string> = {
    info:    'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error:   'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-lg border p-4 text-sm ${variants[variant]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === tab.id
                ? 'border-nhs-blue text-nhs-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Collapsible code block ──────────────────────────────────────────────────

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function CodeBlock({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors font-medium"
      >
        {label}
        {open ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>
      {open && (
        <pre className="p-3 text-xs font-mono bg-gray-950 text-green-400 overflow-auto max-h-72 whitespace-pre-wrap break-all">
          {content}
        </pre>
      )}
    </div>
  );
}

// ─── Risk pill ───────────────────────────────────────────────────────────────

export function RiskPill({ rating }: { rating: string }) {
  const map: Record<string, string> = {
    high:     'bg-red-600 text-white',
    medium:   'bg-orange-500 text-white',
    low:      'bg-yellow-500 text-white',
    none:     'bg-gray-200 text-gray-600',
    strong:   'bg-green-600 text-white',
    moderate: 'bg-yellow-500 text-white',
    weak:     'bg-orange-500 text-white',
  };
  const labels: Record<string, string> = {
    high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk', none: 'No Clinical Content',
    strong: 'Strong', moderate: 'Moderate', weak: 'Weak',
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[rating] ?? 'bg-gray-200 text-gray-600'}`}>
      {labels[rating] ?? rating}
    </span>
  );
}
