export type DeviceCategory = "PHONE" | "LAPTOP" | "GADGET";

export type CatalogModel = {
  name: string;
  storageOptions?: string[];
};

export const defaultStorageOptions = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"] as const;

export const deviceCatalog: Record<DeviceCategory, Record<string, CatalogModel[]>> = {
  PHONE: {
    "Apple iPhone": [
      { name: "iPhone 6s (2015)", storageOptions: ["32GB", "64GB", "128GB"] },
      { name: "iPhone 7 (2016)", storageOptions: ["32GB", "128GB", "256GB"] },
      { name: "iPhone 8 (2017)", storageOptions: ["64GB", "128GB", "256GB"] },
      { name: "iPhone XR (2018)", storageOptions: ["64GB", "128GB", "256GB"] },
      { name: "iPhone 11 (2019)", storageOptions: ["64GB", "128GB", "256GB"] },
      { name: "iPhone 12 (2020)", storageOptions: ["64GB", "128GB", "256GB"] },
      { name: "iPhone 13 (2021)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 14 (2022)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 15 (2023)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 16 (2024)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 17 (2025)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
    ],
    "Samsung Galaxy": [
      { name: "Galaxy S6 (2015)", storageOptions: ["32GB", "64GB", "128GB"] },
      { name: "Galaxy S8 (2017)", storageOptions: ["64GB", "128GB"] },
      { name: "Galaxy S10 (2019)", storageOptions: ["128GB", "512GB", "1TB"] },
      { name: "Galaxy S20 (2020)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Galaxy S21 (2021)", storageOptions: ["128GB", "256GB"] },
      { name: "Galaxy S22 (2022)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Galaxy S23 (2023)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Galaxy S24 (2024)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "Galaxy S25 (2025)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
    ],
    Tecno: [
      { name: "Camon 11 (2018)", storageOptions: ["64GB", "128GB"] },
      { name: "Camon 15 (2020)", storageOptions: ["64GB", "128GB"] },
      { name: "Camon 19 (2022)", storageOptions: ["128GB", "256GB"] },
      { name: "Camon 30 (2024)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Spark 20 (2024)", storageOptions: ["64GB", "128GB", "256GB"] },
    ],
    Infinix: [
      { name: "Hot 10 (2020)", storageOptions: ["64GB", "128GB"] },
      { name: "Hot 20 (2022)", storageOptions: ["128GB", "256GB"] },
      { name: "Hot 40 (2024)", storageOptions: ["128GB", "256GB"] },
      { name: "Note 30 (2023)", storageOptions: ["128GB", "256GB"] },
      { name: "Note 40 (2024)", storageOptions: ["256GB", "512GB"] },
    ],
    Huawei: [
      { name: "P8 (2015)", storageOptions: ["16GB", "32GB"] },
      { name: "P20 (2018)", storageOptions: ["64GB", "128GB"] },
      { name: "P30 (2019)", storageOptions: ["128GB", "256GB"] },
      { name: "P40 (2020)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Mate 60 (2023)", storageOptions: ["256GB", "512GB", "1TB"] },
    ],
    "Google Pixel": [
      { name: "Pixel (2016)", storageOptions: ["32GB", "128GB"] },
      { name: "Pixel 3 (2018)", storageOptions: ["64GB", "128GB"] },
      { name: "Pixel 5 (2020)", storageOptions: ["128GB"] },
      { name: "Pixel 7 (2022)", storageOptions: ["128GB", "256GB"] },
      { name: "Pixel 8 (2023)", storageOptions: ["128GB", "256GB", "512GB"] },
      { name: "Pixel 9 (2024)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "Pixel 10 (2025)", storageOptions: ["128GB", "256GB", "512GB", "1TB"] },
    ],
  },
  LAPTOP: {
    HP: [
      { name: "EliteBook 840 G3 (2016)", storageOptions: ["256GB", "512GB"] },
      { name: "ProBook 450 G7 (2020)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "Pavilion 15 (2022)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "Omen 16 (2024)", storageOptions: ["512GB", "1TB", "2TB"] },
    ],
    Dell: [
      { name: "Latitude 7470 (2016)", storageOptions: ["256GB", "512GB"] },
      { name: "XPS 13 (2019)", storageOptions: ["256GB", "512GB", "1TB", "2TB"] },
      { name: "Inspiron 15 (2021)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "XPS 14 (2024)", storageOptions: ["512GB", "1TB", "2TB"] },
    ],
    Lenovo: [
      { name: "ThinkPad T460 (2016)", storageOptions: ["256GB", "512GB"] },
      { name: "ThinkPad T14 (2021)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "IdeaPad 3 (2022)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "Yoga 9i (2024)", storageOptions: ["512GB", "1TB", "2TB"] },
    ],
    "Apple MacBook": [
      { name: "MacBook Pro 13 (2015)", storageOptions: ["256GB", "512GB"] },
      { name: "MacBook Air M1 (2020)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "MacBook Air M2 (2022)", storageOptions: ["256GB", "512GB", "1TB", "2TB"] },
      { name: "MacBook Pro 14 M3 (2023)", storageOptions: ["512GB", "1TB", "2TB"] },
      { name: "MacBook Pro 14 M4 (2025)", storageOptions: ["512GB", "1TB", "2TB"] },
    ],
    Acer: [
      { name: "Aspire 5 (2018)", storageOptions: ["256GB", "512GB"] },
      { name: "Swift 3 (2021)", storageOptions: ["256GB", "512GB", "1TB"] },
      { name: "Nitro 5 (2024)", storageOptions: ["512GB", "1TB", "2TB"] },
    ],
    Asus: [
      { name: "VivoBook 15 (2019)", storageOptions: ["256GB", "512GB"] },
      { name: "Zenbook 14 (2022)", storageOptions: ["512GB", "1TB"] },
      { name: "ROG Zephyrus G14 (2024)", storageOptions: ["1TB", "2TB"] },
    ],
  },
  GADGET: {
    Generic: [
      { name: "Tablet", storageOptions: ["64GB", "128GB", "256GB"] },
      { name: "Smart Watch" },
      { name: "Router" },
      { name: "Game Console", storageOptions: ["512GB", "1TB", "2TB"] },
      { name: "Headphones" },
    ],
  },
};
