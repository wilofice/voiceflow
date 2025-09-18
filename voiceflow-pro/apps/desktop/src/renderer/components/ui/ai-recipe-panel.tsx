import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Wand2,
  BookOpen,
  ListChecks,
  MessageSquare,
  Languages,
  Sparkles,
  Clock,
  DollarSign,
  Play,
  Settings2,
  Star,
  Copy,
  Edit3,
  ChevronRight,
} from 'lucide-react';

interface RecipeVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  defaultValue?: string | number;
  options?: string[];
  description?: string;
}

interface PromptRecipe {
  id: string;
  name: string;
  description: string;
  category: 'summary' | 'chapters' | 'action_items' | 'translation' | 'custom';
  prompt: string;
  variables: RecipeVariable[];
  estimatedTokens: number;
  estimatedCost: number;
  estimatedTime: string;
  isSystem?: boolean;
  rating?: number;
  usageCount?: number;
}

interface AIRecipePanelProps {
  className?: string;
  recipes?: PromptRecipe[];
  selectedRecipe?: PromptRecipe;
  onRecipeSelect?: (recipe: PromptRecipe) => void;
  onExecute?: (recipe: PromptRecipe, variables: Record<string, any>) => void;
  onSave?: (recipe: PromptRecipe) => void;
  isExecuting?: boolean;
}

const mockRecipes: PromptRecipe[] = [
  {
    id: '1',
    name: 'Executive Summary',
    description: 'Generate a concise business-focused summary with key decisions and action items.',
    category: 'summary',
    prompt: 'Create an executive summary of this {content_type} focusing on key decisions, action items, and business impact. Keep it under {word_limit} words and use a {tone} tone.',
    variables: [
      { key: 'content_type', label: 'Content Type', type: 'select', options: ['meeting', 'interview', 'presentation', 'call'], defaultValue: 'meeting' },
      { key: 'word_limit', label: 'Word Limit', type: 'number', defaultValue: 200 },
      { key: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'formal'], defaultValue: 'professional' }
    ],
    estimatedTokens: 150,
    estimatedCost: 0.02,
    estimatedTime: '15s',
    isSystem: true,
    rating: 4.8,
    usageCount: 1247,
  },
  {
    id: '2',
    name: 'Chapter Markers',
    description: 'Automatically create timestamped chapter markers for long-form content.',
    category: 'chapters',
    prompt: 'Analyze this transcript and create chapter markers with timestamps and descriptive titles. Aim for {chapters_count} chapters of roughly equal length.',
    variables: [
      { key: 'chapters_count', label: 'Number of Chapters', type: 'number', defaultValue: 5 },
    ],
    estimatedTokens: 200,
    estimatedCost: 0.03,
    estimatedTime: '20s',
    isSystem: true,
    rating: 4.6,
    usageCount: 892,
  },
  {
    id: '3',
    name: 'Action Items Extraction',
    description: 'Extract actionable tasks with owners and deadlines.',
    category: 'action_items',
    prompt: 'Extract all action items from this transcript. For each item, identify the task, assigned person (if mentioned), and any mentioned deadlines. Format as a {format} list.',
    variables: [
      { key: 'format', label: 'Output Format', type: 'select', options: ['markdown', 'bullet points', 'numbered list'], defaultValue: 'markdown' },
    ],
    estimatedTokens: 120,
    estimatedCost: 0.018,
    estimatedTime: '12s',
    isSystem: true,
    rating: 4.9,
    usageCount: 2156,
  },
];

const categoryIcons = {
  summary: BookOpen,
  chapters: ListChecks,
  action_items: ListChecks,
  translation: Languages,
  custom: Wand2,
};

const categoryColors = {
  summary: 'text-primary',
  chapters: 'text-success',
  action_items: 'text-warning',
  translation: 'text-purple-500',
  custom: 'text-text-secondary',
};

export const AIRecipePanel: React.FC<AIRecipePanelProps> = ({
  className,
  recipes = mockRecipes,
  selectedRecipe,
  onRecipeSelect,
  onExecute,
  onSave,
  isExecuting = false,
}) => {
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All Recipes' },
    { value: 'summary', label: 'Summaries' },
    { value: 'chapters', label: 'Chapters' },
    { value: 'action_items', label: 'Action Items' },
    { value: 'translation', label: 'Translation' },
    { value: 'custom', label: 'Custom' },
  ];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleVariableChange = (key: string, value: any) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
    if (selectedRecipe) {
      // Merge default values with user inputs
      const finalVariables = { ...variables };
      selectedRecipe.variables.forEach(variable => {
        if (!(variable.key in finalVariables)) {
          finalVariables[variable.key] = variable.defaultValue;
        }
      });
      onExecute?.(selectedRecipe, finalVariables);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background border-l border-border", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary mb-3">AI Recipes</h2>
        
        {/* Search */}
        <Input
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-3"
        />
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-1">
          {categories.map((category) => (
            <Button
              key={category.value}
              variant={selectedCategory === category.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category.value)}
              className="text-xs"
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Recipe List */}
        <ScrollArea className="flex-1 border-r border-border">
          <div className="p-2 space-y-2">
            {filteredRecipes.map((recipe) => {
              const CategoryIcon = categoryIcons[recipe.category];
              const isSelected = selectedRecipe?.id === recipe.id;
              
              return (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:bg-surface-alt/50",
                      isSelected && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => onRecipeSelect?.(recipe)}
                    data-testid={`recipe-${recipe.id}`}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className={cn("w-4 h-4", categoryColors[recipe.category])} />
                          <CardTitle className="text-sm">{recipe.name}</CardTitle>
                          {recipe.isSystem && (
                            <Badge variant="secondary" className="text-xs">
                              System
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                      </div>
                      <CardDescription className="text-xs">
                        {recipe.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{recipe.estimatedTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span>${recipe.estimatedCost.toFixed(3)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {recipe.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current text-warning" />
                              <span>{recipe.rating}</span>
                            </div>
                          )}
                          <span>{recipe.usageCount} uses</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Recipe Editor/Executor */}
        <div className="w-80 flex flex-col">
          {selectedRecipe ? (
            <>
              {/* Recipe Details */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text-primary">{selectedRecipe.name}</h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                      <Star className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-text-secondary mb-3">{selectedRecipe.description}</p>
                
                {/* Cost Estimate */}
                <div className="flex items-center justify-between p-2 rounded bg-surface-alt/30">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-text-secondary">Estimated cost:</span>
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    ${selectedRecipe.estimatedCost.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Variables */}
              {selectedRecipe.variables.length > 0 && (
                <div className="p-4 border-b border-border">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Variables</h4>
                  <div className="space-y-3">
                    {selectedRecipe.variables.map((variable) => (
                      <div key={variable.key}>
                        <label className="text-xs font-medium text-text-secondary mb-1 block">
                          {variable.label}
                        </label>
                        {variable.type === 'select' ? (
                          <select
                            value={variables[variable.key] || variable.defaultValue}
                            onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                            className="w-full p-2 rounded border border-border bg-background text-text-primary text-sm focus:border-primary focus:outline-none"
                          >
                            {variable.options?.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : variable.type === 'number' ? (
                          <Input
                            type="number"
                            value={variables[variable.key] || variable.defaultValue}
                            onChange={(e) => handleVariableChange(variable.key, Number(e.target.value))}
                            className="text-sm"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={variables[variable.key] || variable.defaultValue || ''}
                            onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                            className="text-sm"
                          />
                        )}
                        {variable.description && (
                          <p className="text-xs text-text-secondary mt-1">{variable.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Preview */}
              <div className="flex-1 p-4">
                <h4 className="text-sm font-semibold text-text-primary mb-2">Prompt Preview</h4>
                <Textarea
                  value={selectedRecipe.prompt}
                  readOnly
                  className="text-sm font-mono resize-none"
                  rows={6}
                />
              </div>

              {/* Execute Button */}
              <div className="p-4 border-t border-border">
                <Button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="w-full bg-gradient-primary hover:opacity-90 focus-ring"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Recipe
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Wand2 className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <p className="text-text-secondary">Select a recipe to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIRecipePanel;