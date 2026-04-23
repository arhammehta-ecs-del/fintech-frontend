import React, { useState } from 'react';
import { ShieldCheck, Database, ChevronDown, CreditCard, FileText, Workflow, Users, GitBranch, Edit2, Building2, Globe, Settings2, Box, MoreHorizontal, Mail, Phone, Calendar, IdCard, UserCheck, Maximize2, Minimize2, ArrowRightLeft, Sparkles, X } from "lucide-react";

export function UserManagePreview() {
  const [activeTab, setActiveTab] = useState('basic'); 
  const allSections = ['transactional', 'primary', 'secondary', 'operational', 'system'];
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  
  // AI States
  const [aiResult, setAiResult] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  
  // User Data
  const userData = {
    name: "Alice Johnson",
    email: "test1@gmail.com",
    phone: "+1 (555) 7890",
    joiningDate: "April 14, 2026",
    designation: "Operations Lead",
    department: "Aluminum",
    employeeId: "EMP-001",
    reportingManager: "Sarah Jenkins",
    reportingManagerEmail: "s.jenkins@acmeglobal.com"
  };

  const toggleSection = (id) => {
    setExpandedSections(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setExpandedSections(expandedSections.length > 0 ? [] : allSections);
  };

  const PermissionStatus = ({ label, isActive }) => (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
      <span className={`text-[12px] font-semibold ${isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );

  const PermissionRow = ({ icon: Icon, title, description, scopePath = [], permissions, isSecondary = false }) => (
    <div className={`group flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${isSecondary ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-4 flex-1">
        <div className={`bg-slate-50 dark:bg-slate-800/50 text-slate-400 rounded-lg group-hover:text-blue-500 transition-colors ${isSecondary ? 'p-1.5' : 'p-2'}`}>
          <Icon size={isSecondary ? 16 : 18} />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={`${isSecondary ? 'text-[12px]' : 'text-[13px]'} font-semibold text-slate-800 dark:text-slate-100`}>{title}</h4>
            {scopePath.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50/60 px-1.5 py-0.5 text-[9px] font-medium tracking-[0.08em] text-blue-600">
                {scopePath.join(' > ')}
              </span>
            )}
          </div>
          <p className={`${isSecondary ? 'text-[11px]' : 'text-[12px]'} text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed`}>{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mt-4 md:mt-0 items-center justify-end">
        {['Approve', 'Manage', 'View']
          .filter(label => permissions.find(p => p.label === label && p.active))
          .map((label) => (
            <PermissionStatus key={label} label={label} isActive={true} />
          ))
        }
        <button className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );

  const SectionCard = ({ id, title, subtitle, icon: Icon, children, isSecondary = false, count = 0, className = '' }) => {
    const isExpanded = expandedSections.includes(id);
    return (
      <div className={`rounded-xl border transition-all duration-200 ${
        isSecondary 
        ? 'border-slate-300 border-dashed dark:border-slate-700 bg-white/80 dark:bg-slate-800/40 ml-10 mb-4 shadow-sm/50' 
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm mb-3'
      } ${className}`}>
        <button 
          onClick={() => toggleSection(id)}
          className={`flex items-center justify-between w-full text-left transition-all ${isSecondary ? 'p-3.5' : 'p-4'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-lg ${isSecondary ? 'text-slate-400 p-1' : 'text-blue-500 p-1.5'}`}>
              <Icon size={16}/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`${isSecondary ? 'text-[13px]' : 'text-[14px]'} font-bold text-slate-800 dark:text-slate-100`}>
                  {title} {count > 0 && <span className="text-slate-400 font-medium ml-1">({count})</span>}
                </h3>
              </div>
              <p className={`${isSecondary ? 'text-[10px]' : 'text-[11px]'} text-slate-500 font-medium`}>{subtitle}</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}/>
        </button>
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? `max-h-[1000px] border-t border-slate-100 dark:border-slate-800/50 ${isSecondary ? '' : 'pt-3'}` : 'max-h-0'}`}>
          {children}
        </div>
      </div>
    );
  };

  const DetailBit = ({ label, value, icon: Icon, subValue = "" }) => (
    <div className="flex items-start gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="mt-1 p-2 bg-slate-100/50 dark:bg-slate-800 rounded-lg text-slate-400">
        <Icon size={14} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{value}</p>
        {subValue && <p className="text-[11px] text-slate-500 font-medium">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-500/10">
      
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/32 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[32px] border border-slate-200/90 bg-[#F8FAFC] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-blue-600 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="animate-pulse" />
                <h3 className="font-bold text-[15px] uppercase tracking-widest">AI Workspace Insights</h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              <div className="prose prose-slate dark:prose-invert max-w-none text-[14px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {aiResult}
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setShowAiModal(false)} className="px-6 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Dismiss</button>
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Apply Suggestions</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8 rounded-[32px] border border-slate-200/80 bg-[#F8FAFC] p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.22)] md:p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start justify-between border-b border-slate-200 pb-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-[20px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-lg font-bold shadow-inner border border-white dark:border-slate-700">
              {userData.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{userData.name}</h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <p className="text-xs text-slate-500 font-semibold">{userData.designation} • {userData.department}</p>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-wider border border-emerald-100 dark:border-emerald-800/50">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    Active
                  </div>
                </div>
              </div>
              <div className="flex gap-8">
                {['basic', 'permissions'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[12px] font-black uppercase tracking-widest pb-3 transition-all relative ${
                      activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab === 'basic' ? 'Basic Details' : 'Access Rights'}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 md:mt-0 flex gap-2">
            <button className="px-5 py-2 text-[12px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm">
              <Edit2 size={14} className="inline mr-2" /> EDIT
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'permissions' && (
            <div className="relative pt-2">
              <div className="absolute -top-11 right-0 flex items-center gap-2">
                
                <button onClick={toggleAll} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition-all shadow-sm group" title={expandedSections.length > 0 ? "Collapse All" : "Expand All"}>
                  {expandedSections.length > 0 ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
              <div className="space-y-1">
                <SectionCard id="transactional" title="Transactional" subtitle="Primary and secondary transaction handling" icon={ArrowRightLeft} count={2}>
                  <SectionCard id="primary" title="Primary Access" subtitle="Core procurement authority" icon={Building2} isSecondary={true} count={1}>
                    <PermissionRow isSecondary icon={FileText} title="Purchase (PO)" scopePath={['PO', 'Aluminum']} description="Manage entity-wide procurement and vendor contracts." permissions={[{label: 'Approve', active: true}, {label: 'Manage', active: true}, {label: 'View', active: true}]} />
                  </SectionCard>
                  <SectionCard id="secondary" title="Secondary Access" subtitle="Internal support and financial processing" icon={Globe} isSecondary={true} count={2} className="ml-16">
                    <PermissionRow isSecondary icon={CreditCard} title="Steel" scopePath={['Test Company']} description="Support steel business processes and cross-functional requests." permissions={[{label: 'Approve', active: true}, {label: 'Manage', active: true}, {label: 'View', active: true}]} />
                    <PermissionRow isSecondary icon={Users} title="HR & Payroll" scopePath={['HR Payroll', 'Pune', 'Strategy']} description="Manage team onboarding and payroll processing." permissions={[{label: 'Approve', active: false}, {label: 'Manage', active: false}, {label: 'View', active: true}]} />
                  </SectionCard>
                </SectionCard>
                <SectionCard id="operational" title="Operations" subtitle="Logistics and system record management" icon={Settings2} count={2}>
                  <PermissionRow icon={Box} title="Inventory Control" scopePath={['Inventory', 'Warehouse 02', 'Steel']} description="Warehouse stock tracking." permissions={[{label: 'Approve', active: true}, {label: 'Manage', active: true}, {label: 'View', active: true}]} />
                  <PermissionRow icon={Database} title="Master Data" scopePath={['Master Data', 'Vendors', 'Strategy']} description="Centralized supplier and product catalogs." permissions={[{label: 'Approve', active: false}, {label: 'Manage', active: false}, {label: 'View', active: true}]} />
                </SectionCard>
                <SectionCard id="system" title="System Management" subtitle="Administrative tools and routing" icon={Workflow} count={3}>
                  <PermissionRow icon={Workflow} title="Workflows" scopePath={['Workflows', 'Approvals', 'Strategy']} description="Logical routing for approval chains." permissions={[{label: 'Approve', active: false}, {label: 'Manage', active: false}, {label: 'View', active: true}]} />
                  <PermissionRow icon={Users} title="User Management" scopePath={['User Management', 'Mumbai', 'Steel']} description="Team access and security credentials." permissions={[{label: 'Approve', active: false}, {label: 'Manage', active: false}, {label: 'View', active: false}]} />
                  <PermissionRow icon={GitBranch} title="Org Structure" scopePath={['Org Structure', 'Pune', 'Aluminum']} description="Business unit mapping." permissions={[{label: 'Approve', active: false}, {label: 'Manage', active: false}, {label: 'View', active: true}]} />
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden relative">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">General Information</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
                    <DetailBit icon={Mail} label="Official Email" value={userData.email} />
                    <DetailBit icon={Phone} label="Mobile Number" value={userData.phone} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 border-t divide-x divide-slate-100 dark:divide-slate-800">
                    <DetailBit icon={IdCard} label="Employee ID" value={userData.employeeId} />
                    <DetailBit icon={Calendar} label="Joining Date" value={userData.joiningDate} />
                  </div>
                </div>
                <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-5 flex flex-col items-center justify-center text-center space-y-3">
                   <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl text-emerald-500"><ShieldCheck size={20} /></div>
                   <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Status</p>
                     <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-tight">Verified Member</p>
                   </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Reporting Structure</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                    <DetailBit icon={UserCheck} label="Reporting Manager" value={userData.reportingManager} subValue={userData.reportingManagerEmail} />
                    <DetailBit icon={Building2} label="Current Designation" value={userData.designation} subValue="Operations Department" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
