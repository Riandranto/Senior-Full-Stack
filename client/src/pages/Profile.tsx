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
import { User, ShieldCheck, Car, FileText, CheckCircle2, Clock, ChevronLeft, ChevronRight, Loader2, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { useLocation } from 'wouter';

const DOCS_PAGE_SIZE = 5;

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

  // Récupérer les documents passager (nouvelle table)
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

  // Récupérer le profil conducteur si l'utilisateur est DRIVER
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

  // Remplir les champs avec les données du profil conducteur
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

  // Upload document passager
  const uploadPassengerDocument = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      setIsUploading(true);
      setUploadType(type);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      const res = await apiFetch('/api/passenger/documents', {
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
    onSettled: () => {
      setIsUploading(false);
      setUploadType('');
    }
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
    if (!vehicleNum || !licenseNum) {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy feno" : "Champs manquants",
        description: lang === 'mg' ? "Ampidiro ny matricule sy ny laharana permis" : "Veuillez entrer la plaque et le numéro de permis"
      });
      return;
    }
    
    try {
      const res = await apiFetch('/api/driver/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicleType: 'TAXI',
          vehicleNumber: vehicleNum, 
          licenseNumber: licenseNum 
        }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to register as driver");
      }
      
      toast({ 
        title: lang === 'mg' ? "Fangatahana nalefa" : "Demande envoyée",
        description: lang === 'mg' ? "Hiandry fankatoavana" : "En attente de validation" 
      });
      
      refetchUser();
      refetchDriverProfile();
      setShowDriverForm(false);
    } catch (error: any) {
      toast({ 
        variant: "destructive",
        title: lang === 'mg' ? "Tsy nety" : "Erreur",
        description: error.message || (lang === 'mg' ? "Tsy afaka nandefa ny fangatahana" : "Impossible d'envoyer la demande")
      });
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
          {/* En-tête profil */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-4"
          >
            <div className="relative group">
              <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-lg overflow-hidden">
                {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <User className="w-10 h-10" />}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-opacity">
                <span className="text-[10px] text-white font-bold">{lang === 'mg' ? 'Hanova' : 'Changer'}</span>
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
              <p className="text-muted-foreground">{user.phone}</p>
              <div className="flex items-center mt-1">
                {user.isApproved ? (
                  <span className="flex items-center text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 mr-1" /> 
                    {lang === 'mg' ? 'Voamarina' : 'Vérifié'}
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 mr-1" /> 
                    {lang === 'mg' ? 'Miandry fanamarinana' : 'En attente'}
                  </span>
                )}
              </div>
            </div>
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
                    <label className="text-sm font-semibold mb-1.5 block">
                      {lang === 'mg' ? 'Sary CIN / Karatra mpianatra' : 'Photo CIN / Carte étudiant'}
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
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Mandefa...' : 'Téléchargement...'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Tsindrio eto raha handefa sary' : 'Cliquez pour télécharger'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Liste des documents soumis (pour passagers) */}
          {user.role === 'PASSENGER' && passengerDocs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
                  {lang === 'mg' ? 'Antontan-taratasy nampidirina' : 'Documents soumis'}
                </h2>
                
                <div className="space-y-2">
                  {paginatedDocs.map((doc, idx) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-muted/20 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {doc.type === 'CIN' ? (lang === 'mg' ? 'CIN / Karatra' : 'CIN / Carte') : doc.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <a 
                            href={doc.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-muted rounded-full"
                            title={lang === 'mg' ? 'Hijery' : 'Voir'}
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </a>
                        )}
                        <button
                          onClick={() => deletePassengerDocument.mutate(doc.id)}
                          className="p-1.5 hover:bg-red-100 rounded-full transition-colors"
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

          {/* Section pour conducteurs - infos véhicule (CORRIGÉE) */}
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
                    {driverProfile?.status === 'PENDING' && !driverProfile?.vehicleNumber && (
                      <p className="text-xs text-amber-500 mt-1">
                        {lang === 'mg' ? 'Ampidiro ny matricule' : 'Entrez la plaque'}
                      </p>
                    )}
                    {driverProfile?.status === 'PENDING' && driverProfile?.vehicleNumber && (
                      <p className="text-xs text-amber-500 mt-1">
                        {lang === 'mg' ? 'Miandry fankatoavana' : 'En attente de validation'}
                      </p>
                    )}
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
                  
                  {/* Bouton de mise à jour pour le conducteur */}
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
                    <p className="text-xs text-red-500 text-center">
                      {lang === 'mg' ? 'Voasambotra ny kaontinao. Mifandraisa amin\'ny admin.' : 'Votre compte est suspendu. Contactez l\'administrateur.'}
                    </p>
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
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Mandefa...' : 'Téléchargement...'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {lang === 'mg' ? 'Tsindrio eto raha handefa sary' : 'Cliquez pour télécharger'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
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
              <Card className="p-6 rounded-3xl border-0 shadow-soft bg-primary/10 space-y-4">
                <h2 className="text-lg font-bold flex items-center text-primary">
                  <Car className="w-5 h-5 mr-2" /> 
                  {lang === 'mg' ? 'Te ho mpamily?' : 'Devenir chauffeur?'}
                </h2>
                <p className="text-sm">
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
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowDriverForm(false)}
                      >
                        {lang === 'mg' ? 'Miverina' : 'Annuler'}
                      </Button>
                      <Button 
                        className="flex-1 bg-primary"
                        onClick={handleBecomeDriver}
                        disabled={!vehicleNum || !licenseNum}
                      >
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
    </MobileLayout>
  );
}