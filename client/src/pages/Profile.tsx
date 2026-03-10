import React, { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/RoleLayout';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { User, ShieldCheck, Car, FileText, CheckCircle2, Clock } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState('');
  const [idCard, setIdCard] = useState('');
  const [vehicleNum, setVehicleNum] = useState('');
  const [licenseNum, setLicenseNum] = useState('');

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const updateUserInfo = useMutation({
    mutationFn: async (data: { name: string; avatar?: string }) => {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mombamomba nohavaozina", description: "Voatahiry ny fanovana." });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    }
  });

  const updateProfile = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/driver/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Nampidirina ny antontan-taratasy", description: "Andraso ny fankatoavan'ny Admin." });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    }
  });

  const handleBecomeDriver = () => {
    updateProfile.mutate({ vehicleNumber: "THT 1234", licenseNumber: "LIC-12345" });
  };

  if (!user) {
    return (
      <MobileLayout role="passenger">
        <div className="flex h-full items-center justify-center pt-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout role={user.role.toLowerCase() as any}>
      <div className="p-4 pt-20 space-y-6">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-lg overflow-hidden">
              {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <User className="w-10 h-10" />}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-opacity">
              <span className="text-[10px] text-white font-bold">Hanova</span>
              <input type="file" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAvatar(URL.createObjectURL(file));
              }} />
            </label>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <input 
                className="text-2xl font-bold font-display bg-transparent border-none p-0 focus:ring-0 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => updateUserInfo.mutate({ name })}
              />
            </div>
            <p className="text-muted-foreground">{user.phone}</p>
            <div className="flex items-center mt-1">
              {user.isApproved ? (
                <span className="flex items-center text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Voamarina
                </span>
              ) : (
                <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3 mr-1" /> Miandry fanamarinana
                </span>
              )}
            </div>
          </div>
        </div>

        <Card className="p-6 rounded-3xl border-0 shadow-soft bg-card/50 backdrop-blur-sm space-y-4">
          <h2 className="text-lg font-bold flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" /> Fanamarinana kaonty
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Sary CIN (Upload)</label>
              <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={() => toast({ title: "CIN nampidirina" })} />
                <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Tsindrio eto raha handefa sary</p>
              </div>
            </div>

            {user.role === 'PASSENGER' ? (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Laharana CIN na Karatra mpianatra</label>
                <Input 
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  placeholder="Laharana karatra"
                  className="h-12 rounded-xl"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Matricule ny fiara</label>
                  <Input 
                    value={vehicleNum}
                    onChange={(e) => setVehicleNum(e.target.value)}
                    placeholder="THT 0000"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Laharana permis</label>
                  <Input 
                    value={licenseNum}
                    onChange={(e) => setLicenseNum(e.target.value)}
                    placeholder="Laharana permis"
                    className="h-12 rounded-xl"
                  />
                </div>
              </>
            )}
            
            <Button 
              className="w-full h-12 rounded-xl font-bold" 
              onClick={() => updateProfile.mutate({})}
              disabled={updateProfile.isPending}
            >
              Hamarino ny kaonty
            </Button>
          </div>
        </Card>

        {user.role === 'PASSENGER' && (
          <Card className="p-6 rounded-3xl border-0 shadow-soft bg-primary/10 space-y-4">
            <h2 className="text-lg font-bold flex items-center text-primary">
              <Car className="w-5 h-5 mr-2" /> Te ho mpamily?
            </h2>
            <p className="text-sm">Ampidiro ny mombamomba ny fiaranao dia ho lasa mpamily ianao rehefa voamarina.</p>
            <Button 
              variant="outline" 
              className="w-full border-primary text-primary hover:bg-primary/10 rounded-xl font-bold"
              onClick={handleBecomeDriver}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Andraso..." : "Hangataka ho mpamily"}
            </Button>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
