import { Check, FileText, Plus, Settings, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { ReportTemplate } from '@/hooks/useReportTemplates';

interface TemplateSelectorProps {
  templates: ReportTemplate[];
  selectedTemplate: ReportTemplate | null;
  onSelectTemplate: (template: ReportTemplate | null) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (template: ReportTemplate) => void;
  onDeleteTemplate: (template: ReportTemplate) => void;
  onSetDefault: (template: ReportTemplate) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  templates,
  selectedTemplate,
  onSelectTemplate,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onSetDefault,
  disabled = false,
}: TemplateSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <FileText className="h-4 w-4 mr-2" />
          {selectedTemplate ? selectedTemplate.name : 'Default Template'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          Report Templates
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCreateTemplate();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Default (all sections) */}
        <DropdownMenuItem
          onClick={() => onSelectTemplate(null)}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Complete Report</span>
            </div>
            {!selectedTemplate && <Check className="h-4 w-4" />}
          </div>
        </DropdownMenuItem>

        {templates.length > 0 && <DropdownMenuSeparator />}

        {/* Custom templates */}
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className="cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{template.name}</span>
                    {template.is_default && (
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  {template.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {template.description}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!template.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(template);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTemplate(template);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Settings className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTemplate(template);
                  }}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {selectedTemplate?.id === template.id && (
                <Check className="h-4 w-4 ml-2" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
