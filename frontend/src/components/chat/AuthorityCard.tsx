// Authority Card Component - Display authority information
'use client';

import { Button, Badge } from '@/components/ui';
import { MapPin, Phone, Mail, MessageCircle, ExternalLink, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface AuthorityCardProps {
  authority: {
    authority: any;
    distance: number;
    isWithinRadius: boolean;
    contactInfo: string;
    whatsappLink?: string;
    emailLink?: string;
  };
}

const typeLabels: Record<string, string> = {
  RT: 'RT',
  RW: 'RW',
  KELURAHAN: 'Kelurahan',
  KECAMATAN: 'Kecamatan',
  DINAS_PU: 'Dinas PU',
  DINAS_BINA_MARGA: 'Dinas Bina Marga',
  POLISI: 'Polisi',
  PLN: 'PLN',
  PDAM: 'PDAM',
  TELKOM: 'Telkom',
  OTHER: 'Lainnya',
};

const typeColors: Record<string, string> = {
  RT: 'gray',
  RW: 'gray',
  KELURAHAN: 'primary',
  KECAMATAN: 'primary',
  DINAS_PU: 'success',
  DINAS_BINA_MARGA: 'success',
  POLISI: 'danger',
  PLN: 'warning',
  PDAM: 'primary',
  TELKOM: 'gray',
  OTHER: 'gray',
};

export function AuthorityCard({ authority }: AuthorityCardProps) {
  const { authority: auth, distance, isWithinRadius, contactInfo, whatsappLink, emailLink } = authority;
  const typeColor = typeColors[auth.type] || 'gray';
  const typeLabel = typeLabels[auth.type] || auth.type;

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div className={clsx('border rounded-xl p-4 transition-all', 
      isWithinRadius ? 'border-success-300 bg-success-50 dark:bg-success-900/10' : 'border-secondary-200 dark:border-secondary-700'
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          `bg-${typeColor}-100 dark:bg-${typeColor}-900/30 text-${typeColor}-600 dark:text-${typeColor}-400`
        )}>
          <MapPin className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-secondary-900 dark:text-white">{auth.name}</span>
            <Badge variant={typeColor as any}>{typeLabel}</Badge>
            {isWithinRadius && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Area Layanan
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400 mb-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{formatDistance(distance)}</span>
            <span className="text-secondary-400">•</span>
            <span>{auth.address}</span>
          </div>
          
          {auth.contactPerson && (
            <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400 mb-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span>Kontak: {auth.contactPerson}</span>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-3">
            {auth.phone && (
              <a 
                href={`tel:${auth.phone}`} 
                className="btn-secondary text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Phone className="w-3 h-3" />
                Telp
              </a>
            )}
            {auth.whatsapp && whatsappLink && (
              <a 
                href={whatsappLink} 
                className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1.5"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </a>
            )}
            {auth.email && emailLink && (
              <a 
                href={emailLink} 
                className="btn-secondary text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="w-3 h-3" />
                Email
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}