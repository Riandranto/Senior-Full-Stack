// client/src/pages/passenger/Profile.tsx (version corrigée - suppression de vehicleYear)
import React, { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { User, ShieldCheck, Car, FileText, CheckCircle2, Clock, ChevronLeft, ChevronRight, Loader2, Trash2, Eye, X, Upload, Mail, Phone, MapPin, Star, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const DOCS_PAGE_SIZE = 5;

// Types de documents avec leurs labels
const DOCUMENT_TYPES: Record<string, { mg: string; fr: string; icon: any; required: boolean }> = {
  CIN: { mg: 'Carte d\'identité', fr: 'Carte d\'identité', icon: FileText, required: true },
  PERMIS: { mg: 'Permis de conduire', fr: 'Permis de conduire', icon: FileText, required: true },
  VEHICLE: { mg: 'Carte grise', fr: 'Carte grise', icon: Car, required: true },
  PHOTO: { mg: 'Photo de profil', fr: 'Photo de profil', icon: User, required: false },
  ATTESTATION: { mg: 'Attestation', fr: 'Attestation', icon: Award, required: false },
};

export default function ProfilePage() {
  const { user, refetch: refetchUser } = useAuth();
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState('');
  const [vehicleNum, setVehicleNum] = useState('');
  const [licenseNum, setLicenseNum] = useState('');
  const [passengerDocs, setPassengerDocs] = useState<any[]>([]);
  const [driverDocs, setDriverDocs] = useState<any[]>([]);
  const [docsPage, setDocsPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<string>('');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [vehicleType, setVehicleType] = useState<'TAXI'|'BAJAJ'|'CAMION'|'4X4'>('TAXI');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleSeats, setVehicleSeats] = useState('');

  // Récupérer les documents passager
  const { data: passengerDocuments = [], refetch: refetchPassengerDocs } = useQuery({
    queryKey: ['/api/passenger/documents'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/passenger/documents', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return data;
      } catch (error) {
        console.error('Failed to fetch passenger documents:', error);
        return [];
      }
    },
    enabled: user?.role === 'PASSENGER',
  });

  // Récupérer le profil conducteur
  const { data: driverProfile, refetch: refetchDriverProfile } = useQuery({
    queryKey: [api.driver.getProfile.path],
    queryFn: async () => {
      try {
        const res = await apiFetch(api.driver.getProfile.path, { credentials: 'include' });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to fetch driver profile');
        return res.json();
      } catch (error) {
        console.error('Failed to fetch driver profile:', error);
        return null;
      }
    },
    enabled: user?.role === 'DRIVER',
  });

  // Récupérer les documents conducteur
  const { data: driverDocuments = [], refetch: refetchDriverDocs } = useQuery({
    queryKey: ['/api/driver/documents'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/driver/documents', { credentials: 'include' });
        if (!res.ok) return [];
        return res.json();
      } catch (error) {
        console.error('Failed to fetch driver documents:', error);
        return [];
      }
    },
    enabled: user?.role === 'DRIVER',
  });

  useEffect(() => {
    if (passengerDocuments.length > 0) {
      setPassengerDocs(passengerDocuments);
    }
  }, [passengerDocuments]);

  useEffect(() => {
    if (driverDocuments.length > 0) {
      setDriverDocs(driverDocuments);
    }
  }, [driverDocuments]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (driverProfile) {
      setVehicleNum(driverProfile.vehicleNumber || '');
      setLicenseNum(driverProfile.licenseNumber || '');
    }
  }, [driverProfile]);

  const updateUserInfo = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiFetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: lang === 'mg' ? "Mombamomba nohavaozina" : "Profil mis à jour",
        description: lang === 'mg' ? "Voatahiry ny fanovana." : "Modifications enregistrées." 
      });
      refetchUser();
    },
    onError: () => {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: lang === 'mg' ? "Tsy afaka nanavao ny mombamomba" : "Impossible de mettre à jour le profil"
      });
    }
  });

  // Upload document passager avec progression
  const uploadPassengerDocument = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      setIsUploading(true);
      setUploadType(type);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      try {
        const res = await apiFetch('/api/passenger/documents', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || "Failed to upload");
        }
        return res.json();
      } finally {
        setTimeout(() => {
          setIsUploading(false);
          setUploadType('');
          setUploadProgress(0);
        }, 500);
      }
    },
    onSuccess: () => {
      toast({ 
        title: lang === 'mg' ? "Nampidirina ny antontan-taratasy" : "Document téléchargé",
        description: lang === 'mg' ? "Voamarina ny kaontinao." : "Votre compte est vérifié." 
      });
      refetchPassengerDocs();
      refetchUser();
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message || (lang === 'mg' ? "Tsy afaka nampiditra ny antontan-taratasy" : "Impossible de télécharger le document")
      });
    },
  });

  // Upload document conducteur
  const uploadDriverDocument = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      setIsUploading(true);
      setUploadType(type);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      const res = await apiFetch('/api/driver/documents', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to upload");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: lang === 'mg' ? "Nampidirina ny antontan-taratasy" : "Document téléchargé",
        description: lang === 'mg' ? "Andraso ny fankatoavan'ny Admin." : "En attente de validation par l'administrateur." 
      });
      refetchDriverDocs();
      refetchUser();
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message || (lang === 'mg' ? "Tsy afaka nampiditra ny antontan-taratasy" : "Impossible de télécharger le document")
      });
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadType('');
    }
  });

  // Supprimer un document passager
  const deletePassengerDocument = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/passenger/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast({ 
        title: lang === 'mg' ? "Voafafa" : "Supprimé",
        description: lang === 'mg' ? "Voafafa ny antontan-taratasy" : "Document supprimé"
      });
      refetchPassengerDocs();
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message
      });
    }
  });

  const handleBecomeDriver = async () => {
    if (!vehicleNum || !licenseNum || !vehicleType) {
      toast({ variant: "destructive", title: "Champs manquants", description: "Veuillez remplir tous les champs obligatoires" });
      return;
    }
    try {
      const res = await apiFetch('/api/driver/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicleType,
          vehicleNumber: vehicleNum,
          licenseNumber: licenseNum,
          vehicleMake: vehicleMake || null,
          vehicleModel: vehicleModel || null,
          vehicleColor: vehicleColor || null,
          vehicleSeats: vehicleSeats ? parseInt(vehicleSeats) : null,
          // vehicleYear supprimé car non présent dans le schéma
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast({ title: "Demande envoyée", description: "En attente de validation" });
      await refetchUser();
      await refetchDriverProfile();
      setShowDriverForm(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer la demande" });
    }
  };

  const handleFileUpload = (type: string, file: File, isDriver: boolean = false) => {
    if (!file) return;
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Lehibe loatra" : "Fichier trop volumineux",
        description: lang === 'mg' ? "10MB ny fetra" : "Limite: 10MB"
      });
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Karazana tsy mety" : "Type non autorisé",
        description: lang === 'mg' ? "JPEG, PNG, PDF ihany" : "Uniquement JPEG, PNG, PDF"
      });
      return;
    }
    
    if (isDriver) {
      uploadDriverDocument.mutate({ file, type });
    } else {
      uploadPassengerDocument.mutate({ file, type });
    }
  };

  const getStatusColor = (status?: string) => {
    switch(status) {
      case 'APPROVED': return 'text-green-500 bg-green-500/10';
      case 'PENDING': return 'text-amber-500 bg-amber-500/10';
      case 'REJECTED': return 'text-red-500 bg-red-500/10';
      case 'SUSPENDED': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-muted-foreground bg-muted/20';
    }
  };

  const getStatusLabel = (status?: string) => {
    if (lang === 'mg') {
      switch(status) {
        case 'APPROVED': return 'Nekenina';
        case 'PENDING': return 'Miandry';
        case 'REJECTED': return 'Nolavina';
        case 'SUSPENDED': return 'Voasambotra';
        default: return 'Tsy fantatra';
      }
    } else {
      switch(status) {
        case 'APPROVED': return 'Approuvé';
        case 'PENDING': return 'En attente';
        case 'REJECTED': return 'Rejeté';
        case 'SUSPENDED': return 'Suspendu';
        default: return 'Inconnu';
      }
    }
  };

  // Pagination des documents
  const docsToShow = user?.role === 'PASSENGER' ? passengerDocs : driverDocs;
  const paginatedDocs = docsToShow.slice((docsPage - 1) * DOCS_PAGE_SIZE, docsPage * DOCS_PAGE_SIZE);
  const totalDocsPages = Math.max(1, Math.ceil(docsToShow.length / DOCS_PAGE_SIZE));

  if (!user) {
    return (
      <MobileLayout role="passenger">
        <div className="flex h-full items-center justify-center pt-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </MobileLayout>
    );
  }

  const role = user.role.toLowerCase() as 'passenger' | 'driver';

  return (
    <MobileLayout role={role}>
      <div className="h-full overflow-y-auto">
        <div className="p-4 pt-20 pb-32 space-y-6">
          {/* En-tête profil amélioré */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <Card className="p-6 rounded-3xl border-0 shadow-soft bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                    <AvatarImage src={avatar} />
                    <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                    <Upload className="w-5 h-5 text-white" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAvatar(URL.createObjectURL(file));
                        }
                      }} 
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <input 
                    className="text-2xl font-bold font-display bg-transparent border-none p-0 focus:ring-0 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => updateUserInfo.mutate({ name })}
                    data-testid="input-profile-name"
                  />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {user.role === 'PASSENGER' ? '🚶 Passager' : user.role === 'DRIVER' ? '🚗 Chauffeur' : '👑 Admin'}
                    </Badge>
                    {user.isApproved ? (
                      <Badge className="bg-green-500/20 text-green-700 border-green-200">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Vérifié
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-700 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" /> En attente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Statistiques pour conducteur */}
              {user.role === 'DRIVER' && driverProfile && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {driverProfile.ratingAvg ? parseFloat(driverProfile.ratingAvg).toFixed(1) : '0.0'}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Note
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {driverProfile.ratingCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Avis</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {driverProfile.online ? '✅' : '⭕'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {driverProfile.online ? 'En ligne' : 'Hors ligne'}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Upload de documents - POUR PASSAGERS */}
          {user.role === 'PASSENGER' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-primary" /> 
                  {lang === 'mg' ? 'Fanamarinana kaonty' : 'Vérification du compte'}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block flex items-center justify-between">
                      <span>{lang === 'mg' ? 'Sary CIN / Karatra mpianatra' : 'Photo CIN / Carte étudiant'}</span>
                      <span className="text-xs text-red-500">*Requis</span>
                    </label>
                    <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload('CIN', file, false);
                        }} 
                      />
                      {isUploading && uploadType === 'CIN' ? (
                        <div className="space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                          <Progress value={uploadProgress} className="w-full h-1" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Mandefa...' : 'Téléchargement...'} {uploadProgress}%
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium">
                            {lang === 'mg' ? 'Tsindrio raha handefa sary' : 'Cliquez pour télécharger'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPEG, PNG ou PDF (max 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Liste des documents soumis (pour passagers) - AMÉLIORÉE */}
          {user.role === 'PASSENGER' && passengerDocs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  {lang === 'mg' ? 'Antontan-taratasy nampidirina' : 'Documents soumis'}
                  <Badge variant="secondary" className="ml-2">{passengerDocs.length}</Badge>
                </h2>
                
                <div className="space-y-2">
                  {paginatedDocs.map((doc, idx) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {DOCUMENT_TYPES[doc.type]?.[lang === 'mg' ? 'mg' : 'fr'] || doc.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString(lang === 'mg' ? 'mg-MG' : 'fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            title={lang === 'mg' ? 'Hijery' : 'Voir'}
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </button>
                        )}
                        <button
                          onClick={() => deletePassengerDocument.mutate(doc.id)}
                          className="p-2 hover:bg-red-100 rounded-full transition-colors"
                          title={lang === 'mg' ? 'Fafana' : 'Supprimer'}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {passengerDocs.length > DOCS_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDocsPage(p => Math.max(1, p - 1))}
                      disabled={docsPage === 1}
                      className="rounded-xl text-xs h-8"
                    >
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      {lang === 'mg' ? 'Teo aloha' : 'Précédent'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {docsPage} / {totalDocsPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDocsPage(p => Math.min(totalDocsPages, p + 1))}
                      disabled={docsPage === totalDocsPages}
                      className="rounded-xl text-xs h-8"
                    >
                      {lang === 'mg' ? 'Manaraka' : 'Suivant'}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Section pour conducteurs - infos véhicule AMÉLIORÉE */}
          {user.role === 'DRIVER' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center">
                  <Car className="w-5 h-5 mr-2 text-primary" /> 
                  {lang === 'mg' ? 'Mombamomba ny fiara' : 'Informations véhicule'}
                </h2>
                
                {/* Statut du profil conducteur */}
                {driverProfile && (
                  <div className={`p-3 rounded-xl ${getStatusColor(driverProfile.status)} flex items-center justify-between`}>
                    <span className="text-sm font-medium">
                      {lang === 'mg' ? 'Status:' : 'Statut:'} {getStatusLabel(driverProfile.status)}
                    </span>
                    {driverProfile.status === 'PENDING' && (
                      <Clock className="w-4 h-4 animate-pulse" />
                    )}
                    {driverProfile.status === 'APPROVED' && (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">
                      {lang === 'mg' ? 'Matricule ny fiara' : 'Plaque d\'immatriculation'}
                    </label>
                    <Input 
                      value={vehicleNum}
                      onChange={(e) => setVehicleNum(e.target.value)}
                      placeholder="THT 0000"
                      className="h-12 rounded-xl"
                      disabled={driverProfile?.status === 'PENDING' && driverProfile?.vehicleNumber}
                      data-testid="input-vehicle-number"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">
                      {lang === 'mg' ? 'Laharana permis' : 'Numéro de permis'}
                    </label>
                    <Input 
                      value={licenseNum}
                      onChange={(e) => setLicenseNum(e.target.value)}
                      placeholder={lang === 'mg' ? 'Laharana permis' : 'Numéro de permis'}
                      className="h-12 rounded-xl"
                      disabled={driverProfile?.status === 'PENDING' && driverProfile?.licenseNumber}
                      data-testid="input-license-number"
                    />
                  </div>
                  
                  {/* Bouton de mise à jour */}
                  {(!driverProfile?.vehicleNumber || !driverProfile?.licenseNumber) && (
                    <Button 
                      className="w-full h-12 rounded-xl font-bold"
                      onClick={handleBecomeDriver}
                      disabled={!vehicleNum || !licenseNum}
                    >
                      {lang === 'mg' ? 'Hanavao ny fangatahana' : 'Mettre à jour la demande'}
                    </Button>
                  )}
                  
                  {driverProfile?.status === 'REJECTED' && (
                    <Button 
                      className="w-full h-12 rounded-xl font-bold"
                      onClick={handleBecomeDriver}
                      disabled={!vehicleNum || !licenseNum}
                    >
                      {lang === 'mg' ? 'Hanavao ny fangatahana' : 'Mettre à jour la demande'}
                    </Button>
                  )}
                  
                  {driverProfile?.status === 'SUSPENDED' && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl text-center">
                      <p className="text-sm text-red-600">
                        {lang === 'mg' ? 'Voasambotra ny kaontinao. Mifandraisa amin\'ny admin.' : 'Votre compte est suspendu. Contactez l\'administrateur.'}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">
                      {lang === 'mg' ? 'Sary permis de conduire' : 'Photo du permis de conduire'}
                    </label>
                    <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload('PERMIS', file, true);
                        }} 
                      />
                      {isUploading && uploadType === 'PERMIS' ? (
                        <div className="space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Mandefa...' : 'Téléchargement...'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium">
                            {lang === 'mg' ? 'Tsindrio raha handefa sary' : 'Cliquez pour télécharger'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPEG, PNG ou PDF (max 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
          {user.role === 'DRIVER' && driverProfile && (
            <Card className="p-6 rounded-3xl space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" /> Caractéristiques du véhicule
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Type :</span> {driverProfile.vehicleType}</div>
                {driverProfile.vehicleMake && <div><span className="text-muted-foreground">Marque :</span> {driverProfile.vehicleMake}</div>}
                {driverProfile.vehicleModel && <div><span className="text-muted-foreground">Modèle :</span> {driverProfile.vehicleModel}</div>}
                {driverProfile.vehicleColor && <div><span className="text-muted-foreground">Couleur :</span> {driverProfile.vehicleColor}</div>}
                {driverProfile.vehicleSeats && <div><span className="text-muted-foreground">Places :</span> {driverProfile.vehicleSeats}</div>}
                <div><span className="text-muted-foreground">Plaque :</span> {driverProfile.vehicleNumber}</div>
              </div>
            </Card>
          )}

          {/* Liste des documents conducteur */}
          {user.role === 'DRIVER' && driverDocs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {lang === 'mg' ? 'Antontan-taratasy nampidirina' : 'Documents soumis'}
                  <Badge variant="secondary" className="ml-2">{driverDocs.length}</Badge>
                </h2>
                
                <div className="space-y-2">
                  {driverDocs.map((doc, idx) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {DOCUMENT_TYPES[doc.type]?.[lang === 'mg' ? 'mg' : 'fr'] || doc.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Devenir conducteur - uniquement pour passagers */}
          {user.role === 'PASSENGER' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-gradient-to-r from-primary/5 to-primary/10 space-y-4">
                <h2 className="text-lg font-bold flex items-center text-primary">
                  <Car className="w-5 h-5 mr-2" /> 
                  {lang === 'mg' ? 'Te ho mpamily?' : 'Devenir chauffeur?'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === 'mg' 
                    ? 'Ampidiro ny mombamomba ny fiaranao dia ho lasa mpamily ianao rehefa voamarina.'
                    : 'Ajoutez les informations de votre véhicule et devenez chauffeur après validation.'}
                </p>
                
                {!showDriverForm ? (
                  <Button 
                    variant="outline" 
                    className="w-full border-primary text-primary hover:bg-primary/10 rounded-xl font-bold"
                    onClick={() => setShowDriverForm(true)}
                    data-testid="button-become-driver"
                  >
                    {lang === 'mg' ? 'Hangataka ho mpamily' : 'Devenir chauffeur'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Input 
                      placeholder={lang === 'mg' ? 'Matricule fiara' : 'Plaque d\'immatriculation'}
                      value={vehicleNum}
                      onChange={(e) => setVehicleNum(e.target.value)}
                      className="rounded-xl"
                    />
                    <Input 
                      placeholder={lang === 'mg' ? 'Laharana permis' : 'Numéro de permis'}
                      value={licenseNum}
                      onChange={(e) => setLicenseNum(e.target.value)}
                      className="rounded-xl"
                    />
                    <div>
                      <label className="text-sm font-semibold">Type de véhicule</label>
                      <select 
                        value={vehicleType} 
                        onChange={(e) => setVehicleType(e.target.value as any)}
                        className="w-full rounded-xl border p-2"
                      >
                        <option value="TAXI">Taxi</option>
                        <option value="BAJAJ">Bajaj</option>
                        <option value="CAMION">Camion</option>
                        <option value="4X4">4x4</option>
                      </select>
                    </div>
                    <Input 
                      placeholder="Marque (ex: Toyota)" 
                      value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)}
                      className="rounded-xl"
                    />
                    <Input 
                      placeholder="Modèle (ex: Hiace)" 
                      value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)}
                      className="rounded-xl"
                    />
                    <Input 
                      placeholder="Couleur" 
                      value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)}
                      className="rounded-xl"
                    />
                    <Input 
                      placeholder="Nombre de places" 
                      value={vehicleSeats} onChange={(e) => setVehicleSeats(e.target.value)}
                      className="rounded-xl"
                    />
                    {/* Suppression du champ Année (vehicleYear) */}
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShowDriverForm(false)}>
                        {lang === 'mg' ? 'Miverina' : 'Annuler'}
                      </Button>
                      <Button className="flex-1 bg-primary" onClick={handleBecomeDriver} disabled={!vehicleNum || !licenseNum || !vehicleType}>
                        {lang === 'mg' ? 'Alefaso' : 'Envoyer'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
          
          <div className="h-4" />
        </div>
      </div>

      {/* Modal de prévisualisation des documents */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {previewDoc && DOCUMENT_TYPES[previewDoc.type]?.[lang === 'mg' ? 'mg' : 'fr'] || 'Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px] bg-muted/20 rounded-xl overflow-hidden">
            {previewDoc?.url ? (
              previewDoc.url.endsWith('.pdf') ? (
                <iframe src={previewDoc.url} className="w-full h-[500px]" title="PDF" />
              ) : (
                <img 
                  src={previewDoc.url} 
                  alt="Document" 
                  className="max-w-full max-h-[500px] object-contain rounded-lg"
                />
              )
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun fichier disponible</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}