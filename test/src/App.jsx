import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from '@/components/ScrollToTop';
import AppShell from '@/components/shell/AppShell';
import Dashboard from '@/pages/Dashboard';
import Squad from '@/pages/Squad';
import Fixtures from '@/pages/Fixtures';
import Standings from '@/pages/Standings';
import Players from '@/pages/Players';
import { UniverseProvider } from '@/lib/universe-context';
export default function App() {
 return <QueryClientProvider client={queryClientInstance}><HashRouter><UniverseProvider><ScrollToTop/><Routes>
 <Route element={<AppShell/>}>
  <Route path="/" element={<Dashboard/>}/>
  <Route path="/rosa" element={<Squad/>}/>
  <Route path="/calendario" element={<Fixtures/>}/>
  <Route path="/classifica" element={<Standings/>}/>
  <Route path="/giocatori" element={<Players/>}/>
 </Route><Route path="*" element={<Dashboard/>}/></Routes></UniverseProvider></HashRouter><Toaster/></QueryClientProvider>;
}
