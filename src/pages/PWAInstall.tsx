import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Check, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Cài đặt BĐS Broker</CardTitle>
          <CardDescription>
            Cài đặt ứng dụng để truy cập nhanh và làm việc offline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <>
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span className="font-medium">Đã cài đặt thành công!</span>
              </div>
              <Button onClick={() => navigate("/broker/dashboard")} className="w-full" size="lg">
                Mở Dashboard
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Truy cập nhanh</h3>
                    <p className="text-sm text-muted-foreground">
                      Mở ứng dụng ngay từ màn hình chính
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Làm việc offline</h3>
                    <p className="text-sm text-muted-foreground">
                      Tiếp tục làm việc ngay cả khi mất kết nối
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Trải nghiệm native</h3>
                    <p className="text-sm text-muted-foreground">
                      Cảm giác như ứng dụng thật sự
                    </p>
                  </div>
                </div>
              </div>

              {deferredPrompt ? (
                <Button onClick={handleInstallClick} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  Cài đặt ngay
                </Button>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Để cài đặt trên điện thoại:
                  </p>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">iOS: Safari → Chia sẻ → Thêm vào Màn hình chính</p>
                    <p className="font-medium">Android: Menu → Thêm vào Màn hình chính</p>
                  </div>
                </div>
              )}

              <Button onClick={() => navigate("/broker/dashboard")} variant="outline" className="w-full">
                Bỏ qua, tiếp tục trên web
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
