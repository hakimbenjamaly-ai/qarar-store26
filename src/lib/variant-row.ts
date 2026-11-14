// شكل صف الخيار في نموذج المنتج — مشترك بين الخادم والمتصفح
export type VariantRow = {
  id?: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  price: string;
  compareAtPrice: string;
  stockQty: string;
  active: boolean;
  cost: {
    purchasePrice: string;
    purchaseCurrency: string;
    shippingCost: string;
    shippingCurrency: string;
    otherFeesLyd: string;
    localDeliveryLyd: string;
    marginType: "PERCENT" | "FIXED";
    marginValue: string;
  };
};

export const emptyVariant = (sku = ""): VariantRow => ({
  sku,
  name: "",
  size: "",
  color: "",
  price: "",
  compareAtPrice: "",
  stockQty: "0",
  active: true,
  cost: { purchasePrice: "", purchaseCurrency: "USD", shippingCost: "", shippingCurrency: "USD", otherFeesLyd: "", localDeliveryLyd: "", marginType: "PERCENT", marginValue: "" },
});

