import type { FinancialRule } from "../rules/contracts";
import type { FinancialProduct } from "./contracts";

export class ProductRegistry {
  private readonly products = new Map<string, FinancialProduct>();

  register(product: FinancialProduct): void {
    const validation = product.validate();
    if (!validation.valid) {
      const summary = validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ");
      throw new Error(`Invalid financial product '${product.id}': ${summary}`);
    }

    this.products.set(product.id, product);
  }

  registerMany(products: readonly FinancialProduct[]): void {
    for (const product of products) {
      this.register(product);
    }
  }

  list(): FinancialProduct[] {
    return Array.from(this.products.values()).sort((left, right) => left.id.localeCompare(right.id));
  }

  getRules(): FinancialRule[] {
    return this.list().flatMap((product) => product.getRules());
  }
}
