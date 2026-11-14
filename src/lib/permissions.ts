// مفاتيح الصلاحيات. المدير العام يعدّل صلاحيات كل دور من لوحة التحكم.
export const PERMISSIONS = {
  "dashboard.view": "عرض لوحة المؤشرات",
  "products.manage": "إدارة المنتجات",
  "categories.manage": "إدارة الأقسام",
  "costs.view": "رؤية التكاليف والأرباح",
  "orders.view": "عرض الطلبات",
  "orders.manage": "تعديل الطلبات وحالاتها",
  "payments.manage": "تسجيل الدفعات",
  "customers.view": "عرض العملاء",
  "customers.manage": "تعديل بيانات العملاء",
  "messages.manage": "رسائل اتصل بنا",
  "settings.manage": "إعدادات المتجر",
  "users.manage": "المستخدمون والصلاحيات",
  "audit.view": "سجل العمليات",
  "purchasing.manage": "المشتريات الخارجية (المرحلة ٢)",
  "shipping.manage": "الشحن الدولي (المرحلة ٢)",
  "delivery.manage": "التوزيع المحلي (المرحلة ٣)",
  "delivery.partner": "بوابة موظف النورس (المرحلة ٣)",
  "reports.view": "التقارير (المرحلة ٤)",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: { key: string; name: string; permissions: Permission[] }[] = [
  { key: "super_admin", name: "المدير العام", permissions: ALL_PERMISSIONS },
  {
    key: "site_manager",
    name: "مدير الموقع",
    permissions: ["dashboard.view", "products.manage", "categories.manage", "orders.view", "orders.manage", "customers.view", "customers.manage", "messages.manage", "settings.manage"],
  },
  { key: "products_manager", name: "مسؤول المنتجات", permissions: ["products.manage", "categories.manage", "costs.view"] },
  { key: "purchasing_officer", name: "مسؤول المشتريات الخارجية", permissions: ["orders.view", "costs.view", "purchasing.manage"] },
  { key: "shipping_officer", name: "مسؤول الشحن الدولي", permissions: ["orders.view", "shipping.manage"] },
  { key: "distribution_officer", name: "مسؤول التوزيع المحلي", permissions: ["orders.view", "orders.manage", "delivery.manage", "customers.view"] },
  { key: "accountant", name: "المحاسب", permissions: ["dashboard.view", "orders.view", "payments.manage", "costs.view", "customers.view", "reports.view"] },
  { key: "customer_service", name: "موظف خدمة العملاء", permissions: ["orders.view", "orders.manage", "customers.view", "customers.manage", "messages.manage"] },
  { key: "nawras_staff", name: "موظف شركة النورس", permissions: ["delivery.partner"] },
];
