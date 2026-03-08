import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  LogOut,
  Menu,
  Pencil,
  Palette,
  DollarSign,
  CreditCard,
  Shield
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NotificationBell from "@/components/notifications/NotificationBell";
import { sendMCRNotifications } from "@/components/mcr/mcrNotifications";

const navigationItems = [
  {
    title: "My Day",
    url: createPageUrl("MyDay"),
    icon: Calendar,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "Team Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "Activity Logs",
    url: createPageUrl("Logs"),
    icon: FileText,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "Friday Schedule",
    url: createPageUrl("Schedule"),
    icon: Calendar,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "VIM Entry",
    url: createPageUrl("VIMEntry"),
    icon: DollarSign,
    requireVimAccess: true
  },
  {
    title: "Payment Plans",
    url: createPageUrl("PaymentPlans"),
    icon: DollarSign,
    roles: ["admin"]
  },
  {
    title: "Medicaid Babies",
    url: createPageUrl("MedicaidBabies"),
    icon: CreditCard,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "MCR Benefit Tracker",
    url: createPageUrl("MedicareTracker"),
    icon: Shield,
    roles: ["staff", "manager", "admin"]
  },
  {
    title: "Team Members",
    url: createPageUrl("TeamMembers"),
    icon: Users,
    roles: ["manager", "admin"]
  }
];

const themes = {
  default: {
    name: "Ocean Blue",
    primary: "217 91% 60%",
    primaryDark: "217 91% 50%",
    secondary: "210 40% 96%",
    background: "217 91% 95%",
    foreground: "222 47% 11%",
    card: "217 91% 98%", // Changed from "0 0% 100%"
    cardForeground: "222 47% 11%",
    border: "217 91% 85%",
    input: "217 91% 98%",
    ring: "217 91% 60%",
    muted: "217 91% 90%",
    mutedForeground: "217 50% 25%",
    accent: "217 91% 60%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  },
  pink: {
    name: "Pretty Pink",
    primary: "330 81% 60%",
    primaryDark: "330 81% 50%",
    secondary: "330 100% 98%",
    background: "330 100% 92%", // Changed from "330 100% 95%"
    foreground: "330 81% 15%",
    card: "330 100% 97%", // Changed from "0 0% 100%"
    cardForeground: "330 81% 15%",
    border: "330 100% 85%",
    input: "330 100% 98%",
    ring: "330 81% 60%",
    muted: "330 100% 90%",
    mutedForeground: "330 50% 30%",
    accent: "330 81% 60%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  },
  emerald: {
    name: "Emerald Green",
    primary: "160 84% 39%",
    primaryDark: "160 84% 29%",
    secondary: "138 76% 97%",
    background: "160 84% 92%", // Changed from "160 84% 95%"
    foreground: "155 44% 15%",
    card: "160 84% 97%", // Changed from "0 0% 100%"
    cardForeground: "155 44% 15%",
    border: "160 84% 80%",
    input: "160 84% 98%",
    ring: "160 84% 39%",
    muted: "160 84% 90%",
    mutedForeground: "160 50% 25%",
    accent: "160 84% 39%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  },
  purple: {
    name: "Royal Purple",
    primary: "262 83% 58%",
    primaryDark: "262 83% 48%",
    secondary: "270 100% 98%",
    background: "262 83% 92%", // Changed from "262 83% 95%"
    foreground: "260 100% 15%",
    card: "262 83% 97%", // Changed from "0 0% 100%"
    cardForeground: "260 100% 15%",
    border: "262 83% 85%",
    input: "262 83% 98%",
    ring: "262 83% 58%",
    muted: "262 83% 90%",
    mutedForeground: "262 50% 25%",
    accent: "262 83% 58%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  },
  warm: {
    name: "Sunset Warm",
    primary: "24 95% 53%",
    primaryDark: "24 95% 43%",
    secondary: "33 100% 96%",
    background: "33 100% 88%", // Changed from "33 100% 92%"
    foreground: "24 45% 15%",
    card: "33 100% 94%", // Changed from "0 0% 100%"
    cardForeground: "24 45% 15%",
    border: "33 100% 80%",
    input: "33 100% 98%",
    ring: "24 95% 53%",
    muted: "33 100% 85%", // Changed from "33 100% 88%"
    mutedForeground: "33 50% 25%",
    accent: "32 95% 44%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  },
  pooh: {
    name: "Winnie the Pooh",
    primary: "45 100% 51%",
    primaryDark: "45 100% 41%",
    secondary: "48 100% 96%",
    background: "48 100% 92%",
    foreground: "25 47% 15%",
    card: "48 100% 97%",
    cardForeground: "25 47% 15%",
    border: "45 100% 80%",
    input: "48 100% 98%",
    ring: "45 100% 51%",
    muted: "45 100% 88%",
    mutedForeground: "45 50% 25%",
    accent: "0 70% 55%",
    accentForeground: "0 0% 100%",
    destructive: "0 84% 60%",
    success: "160 84% 39%",
    warning: "38 92% 50%"
  }
};

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [selectedTheme, setSelectedTheme] = React.useState("default");
  const [canAccessVim, setCanAccessVim] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadUser();
  }, []);

  React.useEffect(() => {
    if (user?.theme) {
      setSelectedTheme(user.theme);
      applyTheme(user.theme);
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      // Fire MCR notifications on every app load (non-blocking)
      sendMCRNotifications();
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const applyTheme = (themeName) => {
    const theme = themes[themeName] || themes.default;
    const root = document.documentElement;
    
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'name') {
        root.style.setProperty(`--${key}`, value);
      }
    });

    // Apply Pooh background
    if (themeName === 'pooh') {
      document.body.style.backgroundImage = 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e68bf223f90d169d2f006d/f4a3ada80_Pooh.jpg)';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = 'none';
    }
  };

  const handleThemeChange = (newTheme) => {
    setSelectedTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleEditProfile = () => {
    setEditName(user?.display_name || user?.full_name || "");
    setSelectedTheme(user?.theme || "default");
    setCanAccessVim(user?.can_access_vim || false);
    setShowEditProfile(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await base44.entities.User.update(user.id, { 
        display_name: editName,
        theme: selectedTheme,
        can_access_vim: canAccessVim
      });
      
      if (user?.id) {
        const userLogs = await base44.entities.DailyLog.filter({ user_id: user.id });
        for (const log of userLogs) {
          await base44.entities.DailyLog.update(log.id, { user_name: editName });
        }
        
        const userAuditLogs = await base44.entities.AuditLog.filter({ user_id: user.id });
        for (const auditLog of userAuditLogs) {
          await base44.entities.AuditLog.update(auditLog.id, { user_name: editName });
        }
      }
      
      setShowEditProfile(false);
      alert("Profile updated successfully! Your name has been updated everywhere. The page will now reload.");
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Error updating profile. Please try again.");
      setSaving(false);
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const filteredNavItems = navigationItems.filter(item => {
    if (item.requireVimAccess && !user?.can_access_vim) return false;
    return !item.roles || (user && item.roles.includes(user.app_role || "staff"));
  });

  return (
    <>
      <style>{`
        :root {
          --primary: 217 91% 60%;
          --primary-dark: 217 91% 50%;
          --secondary: 210 40% 96%;
          --background: 217 91% 95%;
          --foreground: 222 47% 11%;
          --card: 217 91% 98%;
          --card-foreground: 222 47% 11%;
          --border: 217 91% 85%;
          --input: 217 91% 98%;
          --ring: 217 91% 60%;
          --muted: 217 91% 90%;
          --muted-foreground: 217 50% 25%;
          --accent: 217 91% 60%;
          --accent-foreground: 0 0% 100%;
          --destructive: 0 84% 60%;
          --success: 160 84% 39%;
          --warning: 38 92% 50%;
        }
        
        body {
          background-color: hsl(var(--background));
          color: hsl(var(--foreground));
        }
        
        [data-radix-popper-content-wrapper] {
          z-index: 50 !important;
        }
      `}</style>
      
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: selectedTheme === 'pooh' ? 'transparent' : `hsl(var(--background))`, color: `hsl(var(--foreground))` }}>
        {/* Top Navigation Bar */}
        <nav className="sticky top-0 z-50 backdrop-blur-sm border-b shadow-sm" style={{ 
          ...(selectedTheme === 'pooh' && {
            backgroundImage: `url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e68bf223f90d169d2f006d/8d059147a_image.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'repeat',
          }),
          backgroundColor: `hsl(var(--card) / 0.95)`,
          borderColor: `hsl(var(--border))`
        }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--accent)))` }}>
                  <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: `hsl(var(--card-foreground))` }}>FC Productivity</h2>
                  <p className="text-xs hidden sm:block" style={{ color: `hsl(var(--muted-foreground))` }}>Financial Clearance</p>
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      location.pathname === item.url 
                        ? 'font-medium shadow-sm' 
                        : 'hover:bg-opacity-10'
                    }`}
                    style={location.pathname === item.url ? {
                      backgroundColor: `hsl(var(--accent) / 0.1)`,
                      color: `hsl(var(--accent))`
                    } : {
                      color: `hsl(var(--card-foreground))`
                    }}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.title}</span>
                  </Link>
                ))}
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-opacity-10 transition-colors" style={{ color: `hsl(var(--card-foreground))` }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: `linear-gradient(to bottom right, hsl(var(--success)), hsl(var(--accent)))` }}>
                        <span className="text-white font-semibold text-sm">
                          {(user?.display_name || user?.full_name || 'User').charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium hidden sm:block">
                        {user?.display_name || user?.full_name || 'User'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" style={{ 
                    backgroundColor: `hsl(var(--card))`,
                    borderColor: `hsl(var(--border))`
                  }}>
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium" style={{ color: `hsl(var(--card-foreground))` }}>
                        {user?.display_name || user?.full_name || 'User'}
                      </p>
                      <p className="text-xs capitalize" style={{ color: `hsl(var(--muted-foreground))` }}>
                        {user?.app_role || 'staff'}
                      </p>
                    </div>
                    <DropdownMenuSeparator style={{ backgroundColor: `hsl(var(--border))` }} />
                    <DropdownMenuItem onClick={handleEditProfile} style={{ color: `hsl(var(--card-foreground))` }}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} style={{ color: `hsl(var(--card-foreground))` }}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile Menu Button */}
                <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="lg:hidden p-2 rounded-lg hover:bg-opacity-10 transition-colors" style={{ color: `hsl(var(--card-foreground))` }}>
                      <Menu className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" style={{ 
                    backgroundColor: `hsl(var(--card))`,
                    borderColor: `hsl(var(--border))`
                  }}>
                    {filteredNavItems.map((item) => (
                      <DropdownMenuItem key={item.title} asChild>
                        <Link
                          to={item.url}
                          className="flex items-center gap-2"
                          style={{ color: location.pathname === item.url ? `hsl(var(--accent))` : `hsl(var(--card-foreground))` }}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent style={{ backgroundColor: `hsl(var(--card))`, borderColor: `hsl(var(--border))` }}>
          <DialogHeader>
            <DialogTitle style={{ color: `hsl(var(--foreground))` }}>Profile Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" style={{ color: `hsl(var(--foreground))` }}>Display Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter your display name"
                style={{ 
                  backgroundColor: `hsl(var(--background))`,
                  borderColor: `hsl(var(--border))`,
                  color: `hsl(var(--foreground))`
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="theme-select" style={{ color: `hsl(var(--foreground))` }}>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Theme
                </div>
              </Label>
              <Select value={selectedTheme} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select" style={{ 
                  backgroundColor: `hsl(var(--background))`,
                  borderColor: `hsl(var(--border))`,
                  color: `hsl(var(--foreground))`
                }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ 
                  backgroundColor: `hsl(var(--card))`,
                  borderColor: `hsl(var(--border))`
                }}>
                  {Object.entries(themes).map(([key, theme]) => (
                    <SelectItem key={key} value={key} style={{ color: `hsl(var(--foreground))` }}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs" style={{ color: `hsl(var(--muted-foreground))` }}>
                Preview the theme by selecting it, then save to keep your choice
              </p>
            </div>

            {user?.app_role === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="vim-access" style={{ color: `hsl(var(--foreground))` }}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    VIM Entry Access
                  </div>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="vim-access"
                    type="checkbox"
                    checked={canAccessVim}
                    onChange={(e) => setCanAccessVim(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: `hsl(var(--foreground))` }}>
                    Enable access to VIM Entry page
                  </span>
                </div>
              </div>
            )}

            <div className="text-sm pt-2 border-t" style={{ 
              borderColor: `hsl(var(--border))`,
              color: `hsl(var(--muted-foreground))` 
            }}>
              <p><strong>Email:</strong> {user?.email}</p>
              <p className="capitalize"><strong>Role:</strong> {user?.app_role || 'staff'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditProfile(false);
                if (user?.theme) {
                  applyTheme(user.theme);
                  setSelectedTheme(user.theme);
                }
              }}
              disabled={saving}
              style={{ 
                borderColor: `hsl(var(--border))`,
                color: `hsl(var(--foreground))`
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveProfile}
              disabled={saving}
              style={{ 
                background: `linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))`,
                color: 'white'
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}