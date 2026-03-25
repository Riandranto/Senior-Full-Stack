import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit, Trash2, Eye, Image, ExternalLink, Calendar,
  TrendingUp, MousePointer, Eye as EyeIcon, X, CheckCircle, Clock, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface Ad {
  id: number;
  title: string;
  titleFr: string;
  description: string | null;
  descriptionFr: string | null;
  imageUrl: string;
  linkUrl: string | null;
  type: string;
  position: string;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  targetAudience: string;
  impressionCount: number;
  clickCount: number;
  createdAt: string;
}

type AdFormData = {
  title: string;
  titleFr: string;
  description: string;
  descriptionFr: string;
  linkUrl: string;
  type: string;
  position: string;
  priority: string;
  startDate: string;
  endDate: string;
  targetAudience: string;
  image?: File;
};

const AD_POSITIONS = [
  { value: 'HOME_TOP', label: 'En haut de la page d\'accueil' },
  { value: 'HOME_BOTTOM', label: 'En bas de la page d\'accueil' },
  { value: 'RIDE_SCREEN', label: 'Écran de course' },
  { value: 'PROFILE', label: 'Page profil' },
  { value: 'FULLSCREEN', label: 'Plein écran' },
];

const AD_TYPES = [
  { value: 'BANNER', label: 'Bannière' },
  { value: 'FULLSCREEN', label: 'Plein écran' },
  { value: 'SPLASH', label: 'Splash' },
];

const TARGET_AUDIENCES = [
  { value: 'ALL', label: 'Tous les utilisateurs' },
  { value: 'PASSENGER', label: 'Passagers uniquement' },
  { value: 'DRIVER', label: 'Chauffeurs uniquement' },
];

function AdForm({ ad, onClose, onSubmit, isSubmitting }: { ad?: Ad; onClose: () => void; onSubmit: (data: AdFormData) => void; isSubmitting: boolean }) {
  const { lang } = useTranslation();
  const [formData, setFormData] = useState<AdFormData>({
    title: ad?.title || '',
    titleFr: ad?.titleFr || '',
    description: ad?.description || '',
    descriptionFr: ad?.descriptionFr || '',
    linkUrl: ad?.linkUrl || '',
    type: ad?.type || 'BANNER',
    position: ad?.position || 'HOME_TOP',
    priority: String(ad?.priority || 0),
    startDate: ad?.startDate ? format(new Date(ad.startDate), 'yyyy-MM-dd\'T\'HH:mm') : '',
    endDate: ad?.endDate ? format(new Date(ad.endDate), 'yyyy-MM-dd\'T\'HH:mm') : '',
    targetAudience: ad?.targetAudience || 'ALL',
  });
  const [imagePreview, setImagePreview] = useState<string>(ad?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Titre requis';
    }
    if (!formData.titleFr.trim()) {
      newErrors.titleFr = 'Titre requis';
    }
    if (!imagePreview && !imageFile && !ad?.imageUrl) {
      newErrors.image = 'Image requise';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, image: 'Seules les images sont acceptées' });
        return;
      }
      // Augmenter la limite à 10MB
      if (file.size > 10 * 1024 * 1024) {
        setErrors({ ...errors, image: 'Image trop grande (max 10MB)' });
        return;
      }
      
      setImageFile(file);
      setErrors({ ...errors, image: '' });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const submitData = { ...formData };
    if (imageFile) {
      submitData.image = imageFile;
    }
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Titre (Malagasy) *</label>
          <Input 
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className={`rounded-xl h-9 text-sm ${errors.title ? 'border-destructive' : ''}`}
          />
          {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Titre (Français) *</label>
          <Input 
            value={formData.titleFr}
            onChange={(e) => setFormData({ ...formData, titleFr: e.target.value })}
            required
            className={`rounded-xl h-9 text-sm ${errors.titleFr ? 'border-destructive' : ''}`}
          />
          {errors.titleFr && <p className="text-xs text-destructive mt-1">{errors.titleFr}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Description (Malagasy)</label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Description (Français)</label>
          <Textarea 
            value={formData.descriptionFr}
            onChange={(e) => setFormData({ ...formData, descriptionFr: e.target.value })}
            rows={2}
            className="rounded-xl text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold mb-1 block">Image *</label>
        <div className="flex gap-3 items-start">
          {imagePreview && (
            <div className="relative w-20 h-20 rounded-xl overflow-hidden border">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setImagePreview(''); setImageFile(null); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}
          <label className="flex-1 cursor-pointer">
            <div className="border-2 border-dashed rounded-xl p-3 text-center hover:bg-muted/50 transition-colors">
              <Image className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {imagePreview ? 'Changer l\'image' : 'Cliquez pour sélectionner une image'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                JPG, PNG, GIF (max 5MB)
              </p>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageChange}
            />
          </label>
        </div>
        {errors.image && <p className="text-xs text-destructive mt-1">{errors.image}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Lien URL</label>
          <Input 
            value={formData.linkUrl}
            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
            placeholder="https://..."
            className="rounded-xl h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Priorité</label>
          <Input 
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            placeholder="0-100"
            className="rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Type</label>
          <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
            <SelectTrigger className="rounded-xl h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AD_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Position</label>
          <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v })}>
            <SelectTrigger className="rounded-xl h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AD_POSITIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Audience cible</label>
          <Select value={formData.targetAudience} onValueChange={(v) => setFormData({ ...formData, targetAudience: v })}>
            <SelectTrigger className="rounded-xl h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_AUDIENCES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block">Date de début</label>
          <Input 
            type="datetime-local"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block">Date de fin</label>
          <Input 
            type="datetime-local"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="rounded-xl h-9 text-sm"
          />
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-xl">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            ad ? 'Mettre à jour' : 'Créer'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AdStats({ adId }: { adId: number }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/ads/${adId}/stats`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adId]);

  if (loading) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div className="bg-muted/30 rounded-xl p-2 text-center">
        <EyeIcon className="w-4 h-4 mx-auto mb-1 text-blue-500" />
        <div className="font-bold text-lg">{stats?.impressions || 0}</div>
        <div className="text-[10px] text-muted-foreground">Impressions</div>
      </div>
      <div className="bg-muted/30 rounded-xl p-2 text-center">
        <MousePointer className="w-4 h-4 mx-auto mb-1 text-green-500" />
        <div className="font-bold text-lg">{stats?.clicks || 0}</div>
        <div className="text-[10px] text-muted-foreground">Clics</div>
      </div>
      <div className="bg-muted/30 rounded-xl p-2 text-center">
        <TrendingUp className="w-4 h-4 mx-auto mb-1 text-purple-500" />
        <div className="font-bold text-lg">{stats?.ctr?.toFixed(1) || 0}%</div>
        <div className="text-[10px] text-muted-foreground">CTR</div>
      </div>
    </div>
  );
}

export default function AdminAds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  const { data: ads = [], isLoading } = useQuery<Ad[]>({
    queryKey: ['/api/admin/ads'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ads', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch ads');
      return res.json();
    },
  });

  const createAd = useMutation({
    mutationFn: async (formData: AdFormData) => {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('titleFr', formData.titleFr);
      if (formData.description) data.append('description', formData.description);
      if (formData.descriptionFr) data.append('descriptionFr', formData.descriptionFr);
      if (formData.linkUrl) data.append('linkUrl', formData.linkUrl);
      data.append('type', formData.type);
      data.append('position', formData.position);
      data.append('priority', formData.priority);
      data.append('targetAudience', formData.targetAudience);
      if (formData.startDate) data.append('startDate', formData.startDate);
      if (formData.endDate) data.append('endDate', formData.endDate);
      if (formData.image) data.append('image', formData.image);

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        body: data,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to create ad');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ads'] });
      setShowDialog(false);
      setEditingAd(null);
      toast({ title: 'Publicité créée avec succès' });
    },
    onError: (error: Error) => {
      console.error('Error creating ad:', error);
      toast({ 
        title: 'Erreur lors de la création', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateAd = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AdFormData }) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('titleFr', data.titleFr);
      if (data.description) formData.append('description', data.description);
      if (data.descriptionFr) formData.append('descriptionFr', data.descriptionFr);
      if (data.linkUrl) formData.append('linkUrl', data.linkUrl);
      formData.append('type', data.type);
      formData.append('position', data.position);
      formData.append('priority', data.priority);
      formData.append('targetAudience', data.targetAudience);
      if (data.startDate) formData.append('startDate', data.startDate);
      if (data.endDate) formData.append('endDate', data.endDate);
      if (data.image) formData.append('image', data.image);

      const res = await fetch(`/api/admin/ads/${id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update ad');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ads'] });
      setShowDialog(false);
      setEditingAd(null);
      toast({ title: 'Publicité mise à jour' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erreur lors de la mise à jour', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteAd = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ads/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete ad');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ads'] });
      toast({ title: 'Publicité supprimée' });
    },
    onError: () => {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (ad: Ad) => {
      const formData = new FormData();
      formData.append('title', ad.title);
      formData.append('titleFr', ad.titleFr);
      if (ad.description) formData.append('description', ad.description);
      if (ad.descriptionFr) formData.append('descriptionFr', ad.descriptionFr);
      if (ad.linkUrl) formData.append('linkUrl', ad.linkUrl);
      formData.append('type', ad.type);
      formData.append('position', ad.position);
      formData.append('priority', String(ad.priority));
      formData.append('targetAudience', ad.targetAudience);
      formData.append('isActive', String(!ad.isActive));
      if (ad.startDate) formData.append('startDate', ad.startDate);
      if (ad.endDate) formData.append('endDate', ad.endDate);

      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to toggle ad');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ads'] });
      toast({ title: 'Statut mis à jour' });
    },
  });

  const handleSubmit = (data: AdFormData) => {
    if (editingAd) {
      updateAd.mutate({ id: editingAd.id, data });
    } else {
      createAd.mutate(data);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Accès non autorisé</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display">Gestion des publicités</h1>
            <p className="text-sm text-muted-foreground mt-1">Créez et gérez vos campagnes publicitaires</p>
          </div>
          <Button onClick={() => { setEditingAd(null); setShowDialog(true); }} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Nouvelle publicité
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="rounded-2xl border-0 shadow-sm h-64 animate-pulse bg-muted/20" />
            ))
          ) : ads.length === 0 ? (
            <Card className="col-span-full p-12 text-center rounded-2xl">
              <p className="text-muted-foreground">Aucune publicité pour le moment</p>
              <Button variant="link" onClick={() => setShowDialog(true)} className="mt-2">
                Créer votre première publicité
              </Button>
            </Card>
          ) : (
            ads.map((ad, idx) => (
              <motion.div
                key={ad.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="rounded-2xl border-0 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="relative h-32">
                    <img 
                      src={ad.imageUrl} 
                      alt={ad.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x200?text=Image+non+disponible';
                      }}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant={ad.isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {ad.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Badge variant="outline" className="bg-black/50 text-white border-none text-[10px]">
                        {ad.type}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-sm line-clamp-1">{lang === 'mg' ? ad.title : ad.titleFr}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {AD_POSITIONS.find(p => p.value === ad.position)?.label}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setSelectedAd(ad)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setEditingAd(ad); setShowDialog(true); }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500"
                          onClick={() => {
                            if (confirm('Supprimer cette publicité ?')) {
                              deleteAd.mutate(ad.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <AdStats adId={ad.id} />

                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {formatDate(ad.startDate) || '—'} → {formatDate(ad.endDate) || '∞'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          Priorité {ad.priority}
                        </span>
                        <Switch 
                          checked={ad.isActive}
                          onCheckedChange={() => toggleActive.mutate(ad)}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Dialog de création/édition */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl rounded-2xl" aria-describedby="ad-form-description">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingAd ? 'Modifier la publicité' : 'Nouvelle publicité'}
              </DialogTitle>
              <p id="ad-form-description" className="text-sm text-muted-foreground">
                {editingAd ? 'Modifiez les informations de votre publicité' : 'Créez une nouvelle campagne publicitaire'}
              </p>
            </DialogHeader>
            <AdForm
              ad={editingAd || undefined}
              onClose={() => { setShowDialog(false); setEditingAd(null); }}
              onSubmit={handleSubmit}
              isSubmitting={createAd.isPending || updateAd.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog de visualisation */}
        <Dialog open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
          <DialogContent className="max-w-md rounded-2xl" aria-describedby="ad-preview-description">
            <DialogHeader>
              <DialogTitle className="font-display">Aperçu</DialogTitle>
              <p id="ad-preview-description" className="text-sm text-muted-foreground">
                Aperçu de votre publicité
              </p>
            </DialogHeader>
            {selectedAd && (
              <div className="space-y-4">
                <img 
                  src={selectedAd.imageUrl} 
                  alt={selectedAd.title}
                  className="w-full rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/400x200?text=Image+non+disponible';
                  }}
                />
                <div>
                  <h3 className="font-bold text-lg">{selectedAd.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAd.titleFr}</p>
                  {selectedAd.description && (
                    <p className="text-sm mt-2">{selectedAd.description}</p>
                  )}
                  {selectedAd.linkUrl && (
                    <a 
                      href={selectedAd.linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary mt-3"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {selectedAd.linkUrl}
                    </a>
                  )}
                </div>
                <AdStats adId={selectedAd.id} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}