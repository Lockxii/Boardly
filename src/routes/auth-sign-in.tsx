import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BoardlyBrand } from "@/components/boardly-brand";
import { MousePointer2, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient, fetchCurrentUser } from "@/lib/auth-client";

export function SignInPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading: authLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error: signUpError } = await authClient.signUp.email({ email, password, name });
        if (signUpError) {
          setError(signUpError.message || "Une erreur est survenue");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({ email, password });
        if (signInError) {
          setError(signInError.message || "Email ou mot de passe incorrect");
          setLoading(false);
          return;
        }
      }

      const currentUser = await fetchCurrentUser();
      queryClient.setQueryData(["auth", "me"], currentUser);
      navigate({ to: "/dashboard" });
    } catch {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0A0A] text-neutral-900 dark:text-white font-sans selection:bg-yellow-200 selection:text-black flex">
      {/* Left panel — hero vibes */}
      <div className="hidden lg:flex lg:w-1/2 relative isolate overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]" />
        </div>

        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-[10%] left-[8%] w-40 h-40 bg-[#FFD02F] shadow-xl rotate-[-8deg] p-4 text-base leading-tight flex items-center justify-center text-center text-black/80 font-medium"
            initial={{ opacity: 0, scale: 0.8, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "backOut" }}
          >
            "Enfin un outil qui pense comme moi" 🧠
          </motion.div>

          <motion.div
            className="absolute bottom-[12%] right-[8%] w-48 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xl p-4 rotate-[4deg]"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <p className="text-sm text-neutral-600 dark:text-neutral-300 italic">
              "On a arrêté les slides PowerPoint le lundi matin."
            </p>
            <p className="text-xs font-bold mt-2 text-neutral-400">— Sarah, Product Designer</p>
          </motion.div>

          <motion.div
            className="absolute top-[18%] right-[12%]"
            animate={{ x: [0, -20, -10, 0], y: [0, 12, -6, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          >
            <MousePointer2 className="w-6 h-6 text-[#EC4899] fill-[#EC4899]" />
            <div className="ml-4 -mt-4 bg-[#EC4899] text-white text-xs px-2 py-1 rounded-md font-bold">Julie</div>
          </motion.div>
        </div>

        <div className="relative z-20 max-w-md px-4">
          <motion.h1
            className="text-5xl font-extrabold tracking-tight leading-[1.1] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {isSignUp ? (
              <>
                Créez votre
                <br />
                <span className="text-blue-600">espace créatif.</span>
              </>
            ) : (
              <>
                Bon retour
                <br />
                <span className="relative inline-block">
                  parmi nous.
                  <motion.svg
                    className="absolute -bottom-2 left-0 w-full h-5 text-blue-500"
                    viewBox="0 0 200 9"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    <path d="M2.00025 7.00002C52.1129 2.56214 149.039 -2.3686 197.996 3.84379" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </motion.svg>
                </span>
              </>
            )}
          </motion.h1>
          <motion.p
            className="text-lg text-neutral-600 dark:text-neutral-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {isSignUp
              ? "Rejoignez des équipes qui pensent en visuel, pas en tableaux Excel."
              : "Vos tableaux vous attendent. Reprenez là où vous vous êtes arrêté."}
          </motion.p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-32 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:20px_20px]" />
          <motion.div
            className="absolute top-4 right-6 w-28 h-28 bg-[#FFD02F] shadow-lg rotate-[-6deg] p-3 text-sm font-medium text-black/80 flex items-center justify-center text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            Let's go ✨
          </motion.div>
        </div>

        <div className="w-full max-w-md relative z-10 mt-16 lg:mt-0">
          <BoardlyBrand
            to="/"
            className="text-xl mb-8 hover:opacity-80 transition"
          />

          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              {isSignUp ? "Créez votre compte" : "Bon retour !"}
            </h1>
            <p className="text-neutral-500">
              {isSignUp ? "Quelques secondes suffisent." : "Connectez-vous pour continuer."}
            </p>
          </div>

          <motion.div
            className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isSignUp ? "signup" : "signin"}
                initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6 hidden lg:block">
                  <h2 className="text-2xl font-bold">{isSignUp ? "Créer un compte" : "Se connecter"}</h2>
                  <p className="text-neutral-500 text-sm mt-1">
                    {isSignUp ? "Entrez vos infos pour démarrer." : "Accédez à tous vos tableaux."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold">Nom</Label>
                      <Input
                        id="name"
                        placeholder="Marie Dupont"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="h-11 rounded-xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-visible:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-xl border border-red-100 dark:border-red-900/30"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        {isSignUp ? "Créer mon compte" : "Se connecter"}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium"
              >
                {isSignUp ? "Déjà un compte ? " : "Pas encore de compte ? "}
                <span className="font-semibold underline underline-offset-2">
                  {isSignUp ? "Se connecter" : "S'inscrire gratuitement"}
                </span>
              </button>
            </div>
          </motion.div>

          <p className="text-center text-xs text-neutral-400 mt-6">
            En continuant, vous acceptez nos{" "}
            <span className="underline cursor-pointer hover:text-neutral-600">conditions d'utilisation</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
