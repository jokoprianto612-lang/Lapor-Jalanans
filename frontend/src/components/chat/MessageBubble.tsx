// Message Bubble Component
'use client';

import { ChatMessage } from '@/store/chat';
import { AnalysisCard } from './AnalysisCard';
import { AuthorityCard } from './AuthorityCard';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { CheckCircle, AlertCircle, Bot, User, Settings, Image, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

// Simple markdown renderer for **bold**, *italic*, `inline code`, and newlines
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Bold + inline code + italic parsing per line
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/);
      // Inline code
      const codeMatch = remaining.match(/^([^`]*)`([^`]+)`(.*)$/);
      // Italic (single *)
      const italicMatch = remaining.match(/^([^*]*)\*([^*]+)\*(.*)$/);

      // Pick earliest match
      const matches = [
        boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch[1].length } : null,
        codeMatch ? { type: 'code', match: codeMatch, index: codeMatch[1].length } : null,
        italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch[1].length } : null,
      ].filter(Boolean).sort((a, b) => a!.index - b!.index)[0];

      if (!matches) {
        parts.push(remaining);
        break;
      }

      const { type, match } = matches as { type: string; match: RegExpMatchArray };
      if (match[1]) parts.push(match[1]);

      if (type === 'bold') {
        parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
      } else if (type === 'code') {
        parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.85em] font-mono">{match[2]}</code>);
      } else if (type === 'italic') {
        parts.push(<em key={key++} className="italic">{match[2]}</em>);
      }

      remaining = match[3] ?? '';
    }

    return (
      <span key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { 
    addSuffix: true, 
    locale: id 
  });

  const getRoleIcon = () => {
    switch (message.role) {
      case 'USER': return <User className="w-4 h-4" />;
      case 'ASSISTANT': return <Bot className="w-4 h-4" />;
      case 'SYSTEM': return <Settings className="w-4 h-4" />;
      case 'TOOL': return <AlertCircle className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getRoleColor = () => {
    switch (message.role) {
      case 'USER': return 'bg-primary-600 text-white';
      case 'ASSISTANT': return 'bg-secondary-100 text-secondary-900 dark:bg-secondary-800 dark:text-secondary-100';
      case 'SYSTEM': return 'bg-warning-100 text-warning-900 dark:bg-warning-900/30 dark:text-warning-300';
      case 'TOOL': return 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-secondary-100 text-secondary-900';
    }
  };

  const getAlignClasses = () => 
    isOwn 
      ? 'flex-row-reverse items-end' 
      : 'flex-row items-start';

  const getBubbleClasses = () =>
    clsx(
      'max-w-[80%] rounded-2xl px-4 py-2.5 animate-in',
      isOwn 
        ? 'rounded-br-md' 
        : 'rounded-bl-md',
      getRoleColor()
    );

  return (
    <div className={clsx('flex gap-2 w-full', getAlignClasses())}>
      {!isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
          {getRoleIcon()}
        </div>
      )}
      
      <div className={clsx('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        <div className={getBubbleClasses()}>
          <div className="whitespace-pre-wrap break-words">{renderMarkdown(message.content)}</div>
          
          {/* Metadata: Images */}
          {message.metadata?.images && message.metadata.images.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {message.metadata.images.map((img: string, idx: number) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt={`Image ${idx + 1}`} 
                  className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  loading="lazy"
                />
              ))}
            </div>
          )}
          
          {/* Metadata: Location */}
          {message.metadata?.location && (
            <div className="mt-2 flex items-center gap-1.5 text-xs opacity-80">
              <MapPin className="w-3 h-3" />
              <span>
                {message.metadata.location.latitude.toFixed(6)}, {message.metadata.location.longitude.toFixed(6)}
              </span>
            </div>
          )}
          
          {/* AI Analysis Card */}
          {message.metadata?.aiAnalysis && (
            <AnalysisCard analysis={message.metadata.aiAnalysis} />
          )}
          
          {/* Authority Cards */}
          {message.metadata?.authorities && message.metadata.authorities.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.metadata.authorities.map((auth: any, idx: number) => (
                <AuthorityCard key={idx} authority={auth} />
              ))}
            </div>
          )}
          
          {/* Tool Calls Details */}
          {message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
            <details className="mt-2 group">
              <summary className="flex items-center gap-1.5 text-xs opacity-70 cursor-pointer">
                <span>Detail Proses AI ({message.metadata.toolCalls.length} langkah)</span>
                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-1.5 text-xs font-mono opacity-60">
                {message.metadata.toolCalls.map((tc: any, idx: number) => (
                  <div key={idx} className="p-2 bg-black/5 dark:bg-white/5 rounded">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{tc.name}</span>
                      {tc.error && <span className="text-danger-500">❌ Error: {tc.error}</span>}
                      {!tc.error && tc.result && <span className="text-success-500">✓ Selesai</span>}
                    </div>
                    <pre className="mt-1 overflow-x-auto text-[10px]">{JSON.stringify(tc.args, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] opacity-60">
          <span>{timeAgo}</span>
          {message.role === 'ASSISTANT' && message.metadata?.aiAnalysis && (
            <span className="flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" />
              <span>AI: {Math.round((message.metadata.aiAnalysis.confidence || 0) * 100)}%</span>
            </span>
          )}
        </div>
      </div>
      
      {isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary-100 dark:bg-secondary-800 flex items-center justify-center text-secondary-600 dark:text-secondary-300">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}