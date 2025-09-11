import React from 'react';
import { getStrengthLabel, getStrengthColor, type PasswordStrength } from '@/lib/security/passwordStrength';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  strength: PasswordStrength | null;
  loading?: boolean;
  className?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  strength,
  loading = false,
  className = ''
}) => {
  if (!strength && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Analyzing password...</span>
        </div>
      </div>
    );
  }

  if (!strength) return null;

  const progressValue = (strength.score / 4) * 100;
  const strengthLabel = getStrengthLabel(strength.score);
  const strengthColor = getStrengthColor(strength.score);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Password strength:</span>
          <span 
            className="font-medium"
            style={{ color: strengthColor }}
          >
            {strengthLabel}
          </span>
        </div>
        <Progress 
          value={progressValue} 
          className="h-2"
          style={{
            '--progress-background': strengthColor
          } as React.CSSProperties}
        />
      </div>

      {/* Breach warning */}
      {strength.isCompromised && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-destructive font-medium">Password compromised</p>
            <p className="text-destructive/80">
              This password appeared in {strength.compromisedCount?.toLocaleString()} data breaches. 
              Please choose a different password.
            </p>
          </div>
        </div>
      )}

      {/* Feedback */}
      {(strength.feedback.warning || strength.feedback.suggestions.length > 0) && (
        <div className="space-y-1 text-sm">
          {strength.feedback.warning && (
            <p className="text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {strength.feedback.warning}
            </p>
          )}
          {strength.feedback.suggestions.length > 0 && (
            <div className="text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Suggestions:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    {strength.feedback.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};