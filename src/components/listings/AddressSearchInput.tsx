import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AddressSearchInputProps {
  onAddressSelect: (address: {
    street: string;
    ward: string;
    district: string;
    province: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  placeholder?: string;
}

export const AddressSearchInput = ({
  onAddressSelect,
  placeholder = "Nhập địa chỉ của bạn"
}: AddressSearchInputProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch address suggestions from Nominatim
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery + ", Vietnam"
          )}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Error fetching address suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({
        title: "Lỗi",
        description: "Trình duyệt của bạn không hỗ trợ định vị",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    
    const timeoutId = setTimeout(() => {
      setIsGettingLocation(false);
      toast({
        title: "Hết thời gian",
        description: "Không thể lấy vị trí. Vui lòng thử lại hoặc nhập địa chỉ thủ công.",
        variant: "destructive",
      });
    }, 10000); // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timeoutId);
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          
          const address = data.address || {};
          onAddressSelect({
            street: address.road || address.street || "",
            ward: address.suburb || address.neighbourhood || "",
            district: address.county || address.city_district || address.town || "",
            province: address.city || address.province || address.state || "",
            latitude,
            longitude
          });
          
          setSearchQuery(data.display_name || "");
          setIsOpen(false);
          setIsGettingLocation(false);
          
          toast({
            title: "Thành công",
            description: "Đã lấy vị trí hiện tại của bạn",
          });
        } catch (error) {
          console.error("Error reverse geocoding:", error);
          setIsGettingLocation(false);
          toast({
            title: "Lỗi",
            description: "Không thể xác định địa chỉ từ vị trí của bạn",
            variant: "destructive",
          });
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error("Error getting location:", error);
        setIsGettingLocation(false);
        
        let errorMessage = "Không thể lấy vị trí của bạn";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Bạn đã từ chối quyền truy cập vị trí";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Thông tin vị trí không khả dụng";
        }
        
        toast({
          title: "Lỗi",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSelectSuggestion = (suggestion: any) => {
    const address = suggestion.address || {};
    onAddressSelect({
      street: address.road || address.street || suggestion.display_name.split(",")[0] || "",
      ward: address.suburb || address.neighbourhood || address.quarter || "",
      district: address.county || address.city_district || address.town || "",
      province: address.city || address.province || address.state || "",
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon)
    });
    
    setSearchQuery(suggestion.display_name);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-4 py-6 text-base"
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full mt-2 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-3 h-auto text-left"
            onClick={handleUseCurrentLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 text-primary" />
            )}
            <span className="text-sm">
              {isGettingLocation ? "Đang lấy vị trí..." : "Sử dụng vị trí hiện tại của tôi"}
            </span>
          </Button>

          {isLoadingSuggestions && searchQuery.length >= 3 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Đang tìm kiếm...
            </div>
          )}

          {!isLoadingSuggestions && suggestions.length > 0 && (
            <div className="border-t">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start gap-3 px-4 py-3 h-auto text-left"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{suggestion.display_name}</div>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {!isLoadingSuggestions && searchQuery.length >= 3 && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Không tìm thấy địa chỉ nào
            </div>
          )}
        </div>
      )}
    </div>
  );
};
