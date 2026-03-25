import { useState, useEffect } from "react";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  isLoading: boolean;
  error: string | null;
}

export const useGeocode = (
  province: string,
  district: string,
  ward: string,
  street: string
): GeocodeResult => {
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const geocodeAddress = async () => {
      // Only geocode if we have all required fields
      if (!province || !district || !street) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build the full address
        const addressParts = [street, ward, district, province, "Vietnam"].filter(Boolean);
        const fullAddress = addressParts.join(", ");

        // Use Nominatim (OpenStreetMap) for free geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            fullAddress
          )}&limit=1`
        );

        if (!response.ok) {
          throw new Error("Geocoding failed");
        }

        const data = await response.json();

        if (data && data.length > 0) {
          setLatitude(parseFloat(data[0].lat));
          setLongitude(parseFloat(data[0].lon));
        } else {
          setError("Không tìm thấy tọa độ cho địa chỉ này");
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        setError("Lỗi khi tìm kiếm tọa độ");
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the geocoding request
    const timeoutId = setTimeout(geocodeAddress, 1000);

    return () => clearTimeout(timeoutId);
  }, [province, district, ward, street]);

  return { latitude, longitude, isLoading, error };
};
