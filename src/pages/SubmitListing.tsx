import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { useKycStatus } from "@/hooks/useKycStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from "lucide-react";

import { useImageUpload } from "@/hooks/useImageUpload";
import { Purpose, PriceUnit } from "@/types/listing.types";
import { WizardProgressBar } from "@/components/listings/WizardProgressBar";
import { WizardNavigation } from "@/components/listings/WizardNavigation";
import { WizardHeader } from "@/components/listings/WizardHeader";
import { ListingFormStep1PropertyType } from "@/components/listings/ListingFormStep1PropertyType";
import { ListingFormStep2Location } from "@/components/listings/ListingFormStep2Location";
import { ListingFormStep3LegalAndDirections } from "@/components/listings/ListingFormStep3LegalAndDirections";
import { ListingFormStep3BasicInfo } from "@/components/listings/ListingFormStep3BasicInfo";
import { ListingFormStep4Amenities } from "@/components/listings/ListingFormStep4Amenities";
import { ListingFormStep5Price } from "@/components/listings/ListingFormStep5Price";
import { ListingFormStep6CostsAndFees } from "@/components/listings/ListingFormStep6CostsAndFees";
import { ListingFormStep5Images } from "@/components/listings/ListingFormStep5Images";
import { ListingFormStep5Description } from "@/components/listings/ListingFormStep5Description";
import { ListingFormStep6Contact } from "@/components/listings/ListingFormStep6Contact";
import { ListingFormStep10Review } from "@/components/listings/ListingFormStep10Review";
import { PURPOSES, PRICE_UNITS } from "@/constants/listing.constants";
import { WIZARD_STRUCTURE, getActualStep, getMajorStepFromActual, getTotalSubSteps } from "@/constants/wizard.constants";

const SubmitListing = () => {
  const navigate = useNavigate();
  const { id: listingId } = useParams();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!listingId;
  const { kycStatus, loading: kycLoading } = useKycStatus();
  
  // Wizard state - using major steps and sub steps
  const [majorStep, setMajorStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  const actualStep = getActualStep(majorStep, subStep);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("TOTAL");
  const [area, setArea] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [street, setStreet] = useState("");
  const [apartmentFloorInfo, setApartmentFloorInfo] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("FOR_SALE");
  const [propertyTypeSlug, setPropertyTypeSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [prominentFeatures, setProminentFeatures] = useState("");
  
  // Organization ownership
  const [ownershipType, setOwnershipType] = useState<"personal" | "organization">("personal");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<any[]>([]);
  
  // Dynamic attributes
  const [numBedrooms, setNumBedrooms] = useState("");
  const [numBathrooms, setNumBathrooms] = useState("");
  const [numFloors, setNumFloors] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [houseDirection, setHouseDirection] = useState("");
  const [balconyDirection, setBalconyDirection] = useState("");
  const [landDirection, setLandDirection] = useState("");
  const [facadeWidth, setFacadeWidth] = useState("");
  const [alleyWidth, setAlleyWidth] = useState("");
  const [legalStatus, setLegalStatus] = useState("");
  const [interiorStatus, setInteriorStatus] = useState("");
  const [landType, setLandType] = useState("");
  
  // Amenities
  const [amenities, setAmenities] = useState<string[]>([]);
  
  // Fees
  const [fees, setFees] = useState<any[]>([]);
  
  // Location coordinates
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const { data: propertyTypes } = usePropertyTypes();
  const {
    images,
    imagePreviewUrls,
    uploadingImages,
    handleImageSelect,
    removeImage,
    reorderImages,
    uploadImages: uploadImagesToStorage,
  } = useImageUpload();

  // Auth check and load listing if edit mode
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setSession(session);
      setContactEmail(session.user.email || "");
      
      // Fetch user profile for name
      supabase
        .from("profiles")
        .select("name")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.name) setContactName(data.name);
        });

      // Load listing data if edit mode
      if (isEditMode && listingId) {
        loadListing(listingId, session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate, isEditMode, listingId]);

  const loadListing = async (id: string, userId: string) => {
    const { data: listing, error } = await supabase
      .from("listings")
      .select("*, listing_contacts(*)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !listing) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin tin đăng",
        variant: "destructive",
      });
      navigate("/broker/properties");
      return;
    }

    // Populate form with listing data
    setTitle(listing.title);
    setDescription(listing.description || "");
    setPrice(listing.price?.toString() || "");
    setPriceUnit(listing.price_unit);
    setArea(listing.area?.toString() || "");
    setPurpose(listing.purpose as Purpose);
    setPropertyTypeSlug(listing.property_type_slug);
    setProjectName(listing.project_name || "");
    setProminentFeatures(listing.prominent_features?.join(", ") || "");
    
    // Address
    const address = listing.address as any;
    setProvince(address?.province || "");
    setDistrict(address?.district || "");
    setWard(address?.ward || "");
    setStreet(address?.street || "");
    setApartmentFloorInfo(listing.apartment_floor_info || "");
    setBuildingName(listing.building_name || "");
    
    // Attributes
    const attrs = listing.attributes as any || {};
    setNumBedrooms(attrs.num_bedrooms?.toString() || "");
    setNumBathrooms(attrs.num_bathrooms?.toString() || "");
    setNumFloors(attrs.num_floors?.toString() || "");
    setFloorNumber(attrs.floor_number?.toString() || "");
    setHouseDirection(attrs.house_direction || "");
    setBalconyDirection(attrs.balcony_direction || "");
    setLandDirection(attrs.land_direction || "");
    setFacadeWidth(attrs.facade_width?.toString() || "");
    setAlleyWidth(attrs.alley_width?.toString() || "");
    setLegalStatus(attrs.legal_status || "");
    setInteriorStatus(attrs.interior_status || "");
    setLandType(attrs.land_type || "");
    
    // Amenities
    if (attrs.amenities && Array.isArray(attrs.amenities)) {
      setAmenities(attrs.amenities);
    }
    
    // Fees
    if (attrs.fees && Array.isArray(attrs.fees)) {
      setFees(attrs.fees);
    }

    // Contact info
    const contacts = listing.listing_contacts as any;
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      const contact = contacts[0].contact_info as any;
      setContactName(contact?.name || "");
      setContactPhone(contact?.phone || "");
      setContactEmail(contact?.email || "");
    }
  };

  // Custom sort orders for property types
  const SALE_ORDER = [
    "Căn hộ chung cư",
    "Chung cư mini, căn hộ dịch vụ",
    "Nhà riêng",
    "Nhà biệt thự",
    "Nhà liền kề",
    "Nhà mặt phố",
    "Shophouse",
    "Đất nền dự án",
    "Đất thổ cư",
    "Trang trại, khu nghỉ dưỡng",
    "Kho, nhà xưởng",
    "Khác"
  ];

  const RENT_ORDER = [
    "Căn hộ chung cư",
    "Chung cư mini, căn hộ dịch vụ",
    "Nhà trọ, phòng trọ",
    "Nhà riêng",
    "Nhà biệt thự",
    "Nhà liền kề",
    "Nhà mặt phố",
    "Shophouse",
    "Đất thổ cư",
    "Văn phòng",
    "Kho, nhà xưởng",
    "Khác"
  ];

  const filteredPropertyTypes = (propertyTypes?.filter((type) => {
    const metadata = type.filter_metadata as any;
    const purposeData = metadata?.[purpose];
    
    // Nếu không có data cho purpose này
    if (!purposeData) return false;
    
    // Trường hợp mới: có field available
    if (typeof purposeData === 'object' && 'available' in purposeData) {
      return purposeData.available === true;
    }
    
    // Trường hợp cũ: có mảng filters trực tiếp
    if (Array.isArray(purposeData)) {
      return purposeData.length > 0;
    }
    
    // Trường hợp có object với filters array
    if (purposeData.filters && Array.isArray(purposeData.filters)) {
      return true;
    }
    
    return false;
  }) || []).sort((a, b) => {
    // Select appropriate order based on purpose
    const order = purpose === "FOR_SALE" ? SALE_ORDER : RENT_ORDER;
    
    const indexA = order.indexOf(a.name);
    const indexB = order.indexOf(b.name);
    
    // If both are in the order array, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only A is in the order, it comes first
    if (indexA !== -1) return -1;
    
    // If only B is in the order, it comes first
    if (indexB !== -1) return 1;
    
    // If neither is in the order, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  const currentPropertyType = propertyTypes?.find(pt => pt.slug === propertyTypeSlug);
  const currentFilters = currentPropertyType?.filter_metadata?.[purpose]?.filters || [];

  // Wizard navigation logic
  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1: // Property type
        return !!purpose && !!propertyTypeSlug;
      case 2: // Location
        return !!province && !!district && !!ward && !!street.trim();
      case 3: // Legal and directions
        return true; // Optional
      case 4: // Basic info
        return !!area;
      case 5: // Amenities
        const hasFurniture = amenities.some(a => 
          ['full_furnished', 'basic_furnished', 'unfurnished'].includes(a)
        );
        return hasFurniture;
      case 6: // Price
        return !!price;
      case 7: // Costs & fees
        return true; // Optional
      case 8: // Images
        return isEditMode || images.length > 0;
      case 9: // Description
        return !!title.trim() && description.length >= 80;
      case 10: // Contact
        return !!contactName.trim() && !!contactPhone.trim() && !!contactEmail.trim();
      case 11: // Review
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedFromStep(actualStep)) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc",
        variant: "destructive",
      });
      return;
    }
    
    const totalSubSteps = getTotalSubSteps(majorStep);
    
    // If there are more substeps in current major step, go to next substep
    if (subStep < totalSubSteps) {
      setSubStep(subStep + 1);
    } else {
      // Move to next major step, first substep
      if (majorStep < WIZARD_STRUCTURE.length) {
        setMajorStep(majorStep + 1);
        setSubStep(1);
      }
    }
  };

  const handleBack = () => {
    // If not at first substep, go back one substep
    if (subStep > 1) {
      setSubStep(subStep - 1);
    } else {
      // Go back to previous major step, last substep
      if (majorStep > 1) {
        const prevMajorStep = majorStep - 1;
        const prevTotalSubSteps = getTotalSubSteps(prevMajorStep);
        setMajorStep(prevMajorStep);
        setSubStep(prevTotalSubSteps);
      }
    }
  };

  const handleStepClick = (clickedMajorStep: number) => {
    // Only allow clicking to previous or current major step
    if (clickedMajorStep <= majorStep) {
      setMajorStep(clickedMajorStep);
      setSubStep(1); // Always go to first substep when clicking
    }
  };

  const handleFinalSubmit = () => {
    handleSubmit();
  };

  const handleSaveAsDraft = async () => {
    if (!session) return;

    // Minimal validation - only purpose and property type required
    if (!purpose || !propertyTypeSlug) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn loại giao dịch và loại BĐS trước khi lưu",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Auto-generate values for required fields if empty
      const propertyTypeName = currentPropertyType?.name || "BĐS";
      const purposeLabel = purpose === "FOR_SALE" ? "Bán" : "Cho thuê";
      const autoTitle = title.trim() || `[Nháp] ${purposeLabel} ${propertyTypeName}`;
      const autoDescription = description.trim() || "[Chưa có mô tả]";
      const autoPrice = price ? parseFloat(price) : 0;
      const autoArea = area ? parseFloat(area) : 0;
      
      const draftData: any = {
        user_id: session.user.id,
        status: 'DRAFT' as any,
        purpose,
        property_type_slug: propertyTypeSlug,
        title: autoTitle,
        description: autoDescription,
        price: autoPrice,
        area: autoArea,
        price_unit: priceUnit,
        address: {
          province: province.trim() || null,
          district: district.trim() || null,
          ward: ward.trim() || null,
          street: street.trim() || null,
        },
        apartment_floor_info: apartmentFloorInfo.trim() || null,
        building_name: buildingName.trim() || null,
        prominent_features: prominentFeatures ? prominentFeatures.split(',').map(f => f.trim()) : null,
        project_name: projectName.trim() || null,
        attributes: {
          num_bedrooms: numBedrooms ? parseInt(numBedrooms) : null,
          num_bathrooms: numBathrooms ? parseInt(numBathrooms) : null,
          num_floors: numFloors ? parseInt(numFloors) : null,
          floor_number: floorNumber ? parseInt(floorNumber) : null,
          house_direction: houseDirection || null,
          balcony_direction: balconyDirection || null,
          land_direction: landDirection || null,
          facade_width: facadeWidth ? parseFloat(facadeWidth) : null,
          alley_width: alleyWidth ? parseFloat(alleyWidth) : null,
          legal_status: legalStatus || null,
          interior_status: interiorStatus || null,
          land_type: landType || null,
          amenities: amenities.length > 0 ? amenities : null,
          fees: fees.length > 0 ? fees : null,
        },
        num_bedrooms: numBedrooms ? parseInt(numBedrooms) : null,
        num_bathrooms: numBathrooms ? parseInt(numBathrooms) : null,
        num_floors: numFloors ? parseInt(numFloors) : null,
        floor_number: floorNumber ? parseInt(floorNumber) : null,
        house_direction: houseDirection || null,
        balcony_direction: balconyDirection || null,
        land_direction: landDirection || null,
        facade_width: facadeWidth ? parseFloat(facadeWidth) : null,
        alley_width: alleyWidth ? parseFloat(alleyWidth) : null,
        legal_status: legalStatus || null,
        interior_status: interiorStatus || null,
        land_type: landType || null,
      };

      if (isEditMode && listingId) {
        // Update existing draft
        const { error: listingError } = await supabase
          .from("listings")
          .update(draftData)
          .eq("id", listingId);

        if (listingError) throw listingError;

        // Update contact if exists
        if (contactName.trim() || contactPhone.trim() || contactEmail.trim()) {
          await supabase
            .from("listing_contacts")
            .upsert({
              listing_id: listingId,
              contact_info: {
                name: contactName.trim() || null,
                phone: contactPhone.trim() || null,
                email: contactEmail.trim() || null,
              },
            });
        }
      } else {
        // Create new draft
        const { data: newListing, error: listingError } = await supabase
          .from("listings")
          .insert(draftData)
          .select()
          .single();

        if (listingError) throw listingError;

        // Save contact if provided
        if (contactName.trim() || contactPhone.trim() || contactEmail.trim()) {
          await supabase.from("listing_contacts").insert({
            listing_id: newListing.id,
            contact_info: {
              name: contactName.trim() || null,
              phone: contactPhone.trim() || null,
              email: contactEmail.trim() || null,
            },
          });
        }
      }

      toast({
        title: "Đã lưu tin tạm thành công",
        description: "Bạn có thể tiếp tục chỉnh sửa sau",
      });

      navigate("/broker/properties");
    } catch (error: any) {
      toast({
        title: "Lỗi khi lưu tin tạm",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;

    if (!title.trim() || !description.trim() || !price || !area || !province || !ward || !street) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc",
        variant: "destructive",
      });
      return;
    }

    if (!isEditMode && images.length === 0) {
      toast({
        title: "Thiếu hình ảnh",
        description: "Vui lòng tải lên ít nhất 1 hình ảnh",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;
      if (images.length > 0) {
        imageUrl = await uploadImagesToStorage(session.user.id);
        if (!imageUrl) {
          setLoading(false);
          return;
        }
      }

      const listingData: any = {
        user_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        price_unit: priceUnit,
        area: parseFloat(area),
        address: {
          province: province.trim() || null,
          district: district.trim() || null,
          ward: ward.trim() || null,
          street: street.trim() || null,
        },
        apartment_floor_info: apartmentFloorInfo.trim() || null,
        building_name: buildingName.trim() || null,
        prominent_features: prominentFeatures ? prominentFeatures.split(',').map(f => f.trim()) : null,
        purpose,
        property_type_slug: propertyTypeSlug,
        ...(imageUrl && { image_url: imageUrl }),
        project_name: projectName.trim() || null,
        status: 'PENDING_APPROVAL' as any,
        attributes: {
          num_bedrooms: numBedrooms ? parseInt(numBedrooms) : null,
          num_bathrooms: numBathrooms ? parseInt(numBathrooms) : null,
          num_floors: numFloors ? parseInt(numFloors) : null,
          floor_number: floorNumber ? parseInt(floorNumber) : null,
          house_direction: houseDirection || null,
          balcony_direction: balconyDirection || null,
          land_direction: landDirection || null,
          facade_width: facadeWidth ? parseFloat(facadeWidth) : null,
          alley_width: alleyWidth ? parseFloat(alleyWidth) : null,
          legal_status: legalStatus || null,
          interior_status: interiorStatus || null,
          land_type: landType || null,
          amenities: amenities.length > 0 ? amenities : null,
          fees: fees.length > 0 ? fees : null,
        },
        num_bedrooms: numBedrooms ? parseInt(numBedrooms) : null,
        num_bathrooms: numBathrooms ? parseInt(numBathrooms) : null,
        num_floors: numFloors ? parseInt(numFloors) : null,
        floor_number: floorNumber ? parseInt(floorNumber) : null,
        house_direction: houseDirection || null,
        balcony_direction: balconyDirection || null,
        land_direction: landDirection || null,
        facade_width: facadeWidth ? parseFloat(facadeWidth) : null,
        alley_width: alleyWidth ? parseFloat(alleyWidth) : null,
        legal_status: legalStatus || null,
        interior_status: interiorStatus || null,
        land_type: landType || null,
      };

      if (isEditMode && listingId) {
        const { error: listingError } = await supabase
          .from("listings")
          .update(listingData)
          .eq("id", listingId);

        if (listingError) throw listingError;

        await supabase
          .from("listing_contacts")
          .update({
            contact_info: {
              name: contactName.trim(),
              phone: contactPhone.trim(),
              email: contactEmail.trim(),
            },
          })
          .eq("listing_id", listingId);

        toast({
          title: "Cập nhật thành công",
          description: "Tin đăng đã được cập nhật",
        });
      } else {
        const { data: newListing, error: listingError } = await supabase
          .from("listings")
          .insert(listingData)
          .select()
          .single();

        if (listingError) throw listingError;

        await supabase.from("listing_contacts").insert({
          listing_id: newListing.id,
          contact_info: {
            name: contactName.trim(),
            phone: contactPhone.trim(),
            email: contactEmail.trim(),
          },
        });

        toast({
          title: "Đăng tin thành công",
          description: "Tin đăng của bạn đang chờ duyệt",
        });
      }

      navigate("/broker/properties");
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  // Show KYC verification required screen
  if (!kycLoading && kycStatus && kycStatus !== "APPROVED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {kycStatus === "REJECTED" ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle>
              {kycStatus === "NOT_APPLIED" && "Yêu cầu xác thực tài khoản"}
              {kycStatus === "PENDING_KYC" && "Tài khoản đang chờ xác thực"}
              {kycStatus === "REJECTED" && "Tài khoản bị từ chối"}
            </CardTitle>
            <CardDescription className="mt-2">
              {kycStatus === "NOT_APPLIED" && "Bạn cần hoàn tất xác thực tài khoản trước khi có thể đăng tin."}
              {kycStatus === "PENDING_KYC" && "Yêu cầu xác thực của bạn đang được xem xét. Vui lòng đợi phê duyệt trước khi đăng tin."}
              {kycStatus === "REJECTED" && "Yêu cầu xác thực của bạn đã bị từ chối. Vui lòng liên hệ hỗ trợ hoặc thử lại."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate("/broker/profile")}
              className="w-full"
            >
              {kycStatus === "NOT_APPLIED" ? "Đi đến trang xác thực" : "Xem hồ sơ của tôi"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate("/broker/dashboard")}
              className="w-full"
            >
              Quay về Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getReviewData = () => {
    const purposeLabel = purpose === "FOR_SALE" ? "Bán" : "Cho thuê";
    const propertyTypeLabel = currentPropertyType?.name || "Chưa chọn";
    const addressParts = [street, ward, district, province].filter(Boolean);
    const addressLabel = addressParts.join(", ") || "Chưa nhập";
    const priceUnitLabel = PRICE_UNITS[priceUnit] || priceUnit;

    return {
      purpose: purposeLabel,
      propertyType: propertyTypeLabel,
      address: addressLabel,
      area: area || "0",
      price: price || "0",
      priceUnit: priceUnitLabel,
      title: title || "Chưa nhập",
    };
  };

  const getComprehensiveReviewData = () => {
    const purposeLabel = purpose === "FOR_SALE" ? "Bán" : "Cho thuê";
    const propertyTypeLabel = currentPropertyType?.name || "Chưa chọn";
    const priceUnitLabel = PRICE_UNITS[priceUnit] || priceUnit;

    return {
      purpose: purposeLabel,
      propertyType: propertyTypeLabel,
      province,
      district,
      ward,
      street,
      apartmentFloorInfo,
      buildingName,
      area,
      numBedrooms,
      numBathrooms,
      numFloors,
      floorNumber,
      houseDirection,
      balconyDirection,
      legalStatus,
      interiorStatus,
      facadeWidth,
      alleyWidth,
      amenities,
      price,
      priceUnit: priceUnitLabel,
      fees,
      title,
      description,
      prominentFeatures,
      imagePreviewUrls,
      contactName,
      contactPhone,
      contactEmail,
    };
  };

  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header with Progress */}
      <div className="flex-shrink-0 sticky top-0 z-50 bg-background">
        <WizardHeader 
          currentMajorStep={majorStep}
          currentSubStep={subStep}
          onSaveAndExit={handleSaveAsDraft}
          isSaving={isSaving}
          onStepClick={handleStepClick}
        />
      </div>
      
      {/* Form Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto wizard-content-area">
        <div className="max-w-3xl mx-auto px-6 py-12 pb-24">
          {actualStep === 1 && (
          <ListingFormStep1PropertyType
            purpose={purpose}
            setPurpose={setPurpose}
            propertyTypeSlug={propertyTypeSlug}
            setPropertyTypeSlug={setPropertyTypeSlug}
            filteredPropertyTypes={filteredPropertyTypes}
          />
        )}

        {actualStep === 2 && (
          <ListingFormStep2Location
            province={province}
            setProvince={setProvince}
            district={district}
            setDistrict={setDistrict}
            ward={ward}
            setWard={setWard}
            street={street}
            setStreet={setStreet}
            apartmentFloorInfo={apartmentFloorInfo}
            setApartmentFloorInfo={setApartmentFloorInfo}
            buildingName={buildingName}
            setBuildingName={setBuildingName}
            latitude={latitude}
            setLatitude={setLatitude}
            longitude={longitude}
            setLongitude={setLongitude}
            propertyTypeSlug={propertyTypeSlug}
            purpose={purpose}
            numFloors={numFloors}
            setNumFloors={setNumFloors}
            floorNumber={floorNumber}
            setFloorNumber={setFloorNumber}
          />
        )}

        {actualStep === 3 && (
          <ListingFormStep3LegalAndDirections
            propertyTypeSlug={propertyTypeSlug}
            purpose={purpose}
            legalStatus={legalStatus}
            setLegalStatus={setLegalStatus}
            houseDirection={houseDirection}
            setHouseDirection={setHouseDirection}
            facadeWidth={facadeWidth}
            setFacadeWidth={setFacadeWidth}
            alleyWidth={alleyWidth}
            setAlleyWidth={setAlleyWidth}
          />
        )}

        {actualStep === 4 && (
          <ListingFormStep3BasicInfo
            area={area}
            setArea={setArea}
            numBedrooms={numBedrooms}
            setNumBedrooms={setNumBedrooms}
            numBathrooms={numBathrooms}
            setNumBathrooms={setNumBathrooms}
          />
        )}

        {actualStep === 5 && (
          <ListingFormStep4Amenities
            amenities={amenities}
            setAmenities={setAmenities}
          />
        )}

        {actualStep === 6 && (
          <ListingFormStep5Price
            price={price}
            setPrice={setPrice}
            priceUnit={priceUnit}
            setPriceUnit={setPriceUnit}
          />
        )}

        {actualStep === 7 && (
          <ListingFormStep6CostsAndFees fees={fees} setFees={setFees} />
        )}

        {actualStep === 8 && (
          <ListingFormStep5Images
            imagePreviewUrls={imagePreviewUrls}
            setImagePreviewUrls={reorderImages}
            onImageSelect={handleImageSelect}
            onRemoveImage={removeImage}
          />
        )}

        {actualStep === 9 && (
          <ListingFormStep5Description
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            prominentFeatures={prominentFeatures}
            setProminentFeatures={setProminentFeatures}
          />
        )}

        {actualStep === 10 && (
          <ListingFormStep6Contact
            contactName={contactName}
            setContactName={setContactName}
            contactPhone={contactPhone}
            setContactPhone={setContactPhone}
            contactEmail={contactEmail}
            setContactEmail={setContactEmail}
          />
        )}

        {actualStep === 11 && (
          <ListingFormStep10Review
            data={getComprehensiveReviewData()}
          />
        )}

        <WizardNavigation
          currentStep={actualStep}
          totalSteps={11}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleFinalSubmit}
          canProceed={canProceedFromStep(actualStep)}
          isLoading={loading}
          isUploading={uploadingImages}
        />
        </div>
      </div>
    </div>
  );
};

export default SubmitListing;
