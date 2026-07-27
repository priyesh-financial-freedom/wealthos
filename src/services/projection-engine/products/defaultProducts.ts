import { HomeLoanProduct } from "./HomeLoanProduct";
import { MutualFundProduct } from "./MutualFundProduct";
import { NPSProduct } from "./NPSProduct";
import { PPFProduct } from "./PPFProduct";
import { ProductRegistry } from "./ProductRegistry";
import { PropertyProduct } from "./PropertyProduct";
import { SalaryProduct } from "./SalaryProduct";

export function createDefaultProductRegistry(): ProductRegistry {
  const registry = new ProductRegistry();
  registry.registerMany([
    new SalaryProduct(),
    new PPFProduct(),
    new NPSProduct(),
    new MutualFundProduct(),
    new HomeLoanProduct(),
    new PropertyProduct(),
  ]);
  return registry;
}
