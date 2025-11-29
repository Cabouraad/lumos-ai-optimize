import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Clock, CheckCircle, Edit3, Eye } from 'lucide-react';
import { useContentStudioItems, useUpdateContentStudioItemStatus } from '@/features/content-studio/hooks';
import { ContentStudioDrawer, ContentEditor, type ContentStudioItem } from '@/features/content-studio';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';

export default function ContentStudio() {
  const { data: items, isLoading } = useContentStudioItems();
  const updateStatus = useUpdateContentStudioItemStatus();
  const [selectedItem, setSelectedItem] = useState<ContentStudioItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const { canAccessRecommendations } = useSubscriptionGate();
  const navigate = useNavigate();
  
  const accessCheck = canAccessRecommendations();
  
  if (!accessCheck.hasAccess && !accessCheck.daysRemainingInTrial) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="p-4 rounded-full bg-muted">
            <Crown className="h-12 w-12 text-yellow-500" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Content Studio</h1>
            <p className="text-muted-foreground max-w-md">
              Content Studio is available on Growth and Pro plans. Upgrade to generate AI-optimized content blueprints from your recommendations.
            </p>
          </div>
          <Button onClick={() => navigate('/pricing')}>
            <Crown className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </div>
      </Layout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'in_progress': return 'default';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="h-3 w-3" />;
      case 'in_progress': return <Clock className="h-3 w-3" />;
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const handleViewBlueprint = (item: ContentStudioItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleEditContent = (item: ContentStudioItem) => {
    setSelectedItem(item);
    setEditorMode(true);
    // Update status to in_progress when starting to edit
    if (item.status === 'draft') {
      updateStatus.mutate({ id: item.id, status: 'in_progress' });
    }
  };

  const handleBackFromEditor = () => {
    setEditorMode(false);
    setSelectedItem(null);
  };

  // Show full-screen editor when in editor mode
  if (editorMode && selectedItem) {
    return (
      <Layout>
        <div className="h-[calc(100vh-8rem)]">
          <ContentEditor item={selectedItem} onBack={handleBackFromEditor} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-rose-500" />
              Content Studio
            </h1>
            <p className="text-muted-foreground mt-1">
              Create AI-optimized content with guided frameworks and AI assistance
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/optimizations')}>
            Generate New Blueprint
          </Button>
        </div>

        {/* Content Items Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">{item.topic_key}</CardTitle>
                    <Badge variant={getStatusColor(item.status)} className="flex items-center gap-1">
                      {getStatusIcon(item.status)}
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline">{item.content_type.replace('_', ' ')}</Badge>
                    <span className="text-xs">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {item.llm_targets.slice(0, 3).map((target) => (
                      <Badge key={target} variant="secondary" className="text-xs">
                        {target}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.outline.sections?.length || 0} sections • {item.faqs.length} FAQs
                  </p>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={() => handleViewBlueprint(item)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Blueprint
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={() => handleEditContent(item)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Write Content
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Content Blueprints Yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Generate your first content blueprint from the Optimizations page. Then come back here to write your content with AI assistance.
              </p>
              <Button onClick={() => navigate('/optimizations')}>
                Go to Optimizations
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Content Studio Blueprint Drawer */}
      <ContentStudioDrawer
        item={selectedItem}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedItem(null);
        }}
      />
    </Layout>
  );
}
