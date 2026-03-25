export interface WizardSubStep {
  id: number;
  title: string;
  actualStep: number;
}

export interface WizardMajorStep {
  id: number;
  title: string;
  substeps: WizardSubStep[];
}

export const WIZARD_STRUCTURE: WizardMajorStep[] = [
  {
    id: 1,
    title: "Tổng quan",
    substeps: [
      { id: 1, title: "Loại bất động sản", actualStep: 1 }
    ]
  },
  {
    id: 2,
    title: "Cơ bản",
    substeps: [
      { id: 1, title: "Vị trí", actualStep: 2 },
      { id: 2, title: "Thông tin bổ sung", actualStep: 3 }
    ]
  },
  {
    id: 3,
    title: "Nâng cao",
    substeps: [
      { id: 1, title: "Thông tin cơ bản", actualStep: 4 },
      { id: 2, title: "Tiện ích", actualStep: 5 }
    ]
  },
  {
    id: 4,
    title: "Giá",
    substeps: [
      { id: 1, title: "Đặt giá", actualStep: 6 },
      { id: 2, title: "Chi phí bổ sung", actualStep: 7 }
    ]
  },
  {
    id: 5,
    title: "Đăng tin",
    substeps: [
      { id: 1, title: "Hình ảnh", actualStep: 8 },
      { id: 2, title: "Mô tả", actualStep: 9 },
      { id: 3, title: "Liên hệ", actualStep: 10 }
    ]
  },
  {
    id: 6,
    title: "Gửi duyệt",
    substeps: [
      { id: 1, title: "Xem lại", actualStep: 11 }
    ]
  }
];

export const getActualStep = (majorStep: number, subStep: number): number => {
  const major = WIZARD_STRUCTURE.find(s => s.id === majorStep);
  if (!major) return 1;
  
  const sub = major.substeps[subStep - 1];
  return sub ? sub.actualStep : major.substeps[0].actualStep;
};

export const getMajorStepFromActual = (actualStep: number): { majorStep: number, subStep: number } => {
  for (const major of WIZARD_STRUCTURE) {
    for (let i = 0; i < major.substeps.length; i++) {
      if (major.substeps[i].actualStep === actualStep) {
        return { majorStep: major.id, subStep: i + 1 };
      }
    }
  }
  return { majorStep: 1, subStep: 1 };
};

export const getTotalSubSteps = (majorStep: number): number => {
  const major = WIZARD_STRUCTURE.find(s => s.id === majorStep);
  return major ? major.substeps.length : 1;
};
