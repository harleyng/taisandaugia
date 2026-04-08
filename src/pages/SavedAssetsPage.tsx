import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import BrokerSavedAssets from "@/pages/portal/BrokerSavedAssets";

const SavedAssetsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <BrokerSavedAssets />
      </main>
      <Footer />
    </div>
  );
};

export default SavedAssetsPage;
