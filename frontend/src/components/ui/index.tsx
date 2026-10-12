// UI Components - Reusable components
'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

// Button Component
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-accent-500 text-secondary-950 hover:bg-accent-400 focus:ring-accent-500 font-semibold',
      secondary: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 focus:ring-secondary-500 dark:bg-secondary-800 dark:text-secondary-100 dark:hover:bg-secondary-700',
      danger: 'bg-danger-500 text-white hover:bg-danger-600 focus:ring-danger-500',
      ghost: 'bg-transparent hover:bg-secondary-100 focus:ring-secondary-500 dark:hover:bg-secondary-800',
      outline: 'border border-secondary-300 bg-transparent hover:bg-secondary-50 focus:ring-secondary-500 dark:border-secondary-600 dark:hover:bg-secondary-800',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    
    return (
      <button
        ref={ref}
        className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Input Component
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string; leftIcon?: React.ReactNode }>(
  ({ className, label, error, helperText, id, leftIcon, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="label">{label}</label>}
        <div className="relative">
          {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={clsx('input', leftIcon && 'pl-10', error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20', className)}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
        </div>
        {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-danger-600 dark:text-danger-400" role="alert">{error}</p>}
        {helperText && !error && <p id={`${inputId}-helper`} className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; helperText?: string }>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="label">{label}</label>}
        <textarea
          ref={ref}
          id={inputId}
          className={clsx('input min-h-[100px] resize-y', error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20', className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-danger-600 dark:text-danger-400" role="alert">{error}</p>}
        {helperText && !error && <p id={`${inputId}-helper`} className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// Card Component
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'outlined' | 'elevated' }>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantClasses = {
      default: 'rounded-xl border border-secondary-200 bg-white shadow-sm dark:border-secondary-700 dark:bg-secondary-800',
      outlined: 'rounded-xl border-2 border-secondary-300 bg-white dark:border-secondary-600 dark:bg-secondary-800',
      elevated: 'rounded-xl border border-secondary-200 bg-white shadow-lg dark:border-secondary-700 dark:bg-secondary-800',
    };
    
    return (
      <div ref={ref} className={clsx(variantClasses[variant], className)} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Badge Component
export const Badge = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray' }>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const variantClasses = {
      primary: 'bg-accent-100 text-accent-800 dark:bg-accent-900/30 dark:text-accent-300',
      success: 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
      warning: 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
      danger: 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400',
      gray: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300',
    };
    
    return (
      <span ref={ref} className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantClasses[variant], className)} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Avatar Component
export const Avatar = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { src?: string; alt?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; fallback?: string }>(
  ({ className, src, alt, size = 'md', fallback, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    };
    
    return (
      <div ref={ref} className={clsx('relative inline-flex shrink-0 overflow-hidden rounded-full bg-secondary-100 dark:bg-secondary-800', sizeClasses[size], className)} {...props}>
        {src ? (
          <img src={src} alt={alt || 'Avatar'} className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center w-full h-full font-medium text-secondary-600 dark:text-secondary-300">
            {fallback || alt?.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Separator Component
export const Separator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical'; className?: string }>(
  ({ className, orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-secondary-200 dark:bg-secondary-700',
          orientation === 'horizontal' ? 'w-full h-px' : 'h-full w-px',
          className
        )}
        {...props}
        role="separator"
      />
    );
  }
);

Separator.displayName = 'Separator';

// Spinner Component
export const Spinner = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'md' | 'lg' }>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
    
    return (
      <div ref={ref} className={clsx('inline-block animate-spin text-primary-600', sizeClasses[size], className)} {...props} role="status" aria-label="Loading">
        <svg className="h-full w-full" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';