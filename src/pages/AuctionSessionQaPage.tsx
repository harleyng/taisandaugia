import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Gavel } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CaseQaView } from "@/components/case-qa/CaseQaView";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicAuctionSession } from "@/hooks/usePublicAuctionSessions";

/** /sessions/:id/hoi-dap — trang hỏi đáp công khai của một phiên. */
export default function AuctionSessionQaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, error } = usePublicAuctionSession(id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container flex-1 px-4 py-6">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/sessions" className="transition-colors hover:text-foreground">
            Phiên đấu giá
          </Link>
          {session && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to={`/sessions/${session.id}`} className="max-w-[240px] truncate transition-colors hover:text-foreground">
                {session.title}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Hỏi đáp</span>
            </>
          )}
        </nav>

        {isLoading ? (
          <div className="grid gap-8 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : error || !session ? (
          <div className="py-16 text-center">
            <Gavel className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-bold text-foreground">Không tìm thấy phiên đấu giá</h2>
            <p className="text-sm text-muted-foreground">Phiên có thể chưa được công bố hoặc đã bị gỡ.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/sessions")}>
              Xem các phiên khác
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-1">
              <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => navigate(`/sessions/${session.id}`)}>
                <ArrowLeft className="h-4 w-4" />
                Về trang phiên
              </Button>
              <p className="font-mono text-xs text-muted-foreground">{session.code}</p>
              <h1 className="text-2xl font-bold text-foreground">Hỏi đáp · {session.title}</h1>
            </div>
            <CaseQaView session={session} mode="public" />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
