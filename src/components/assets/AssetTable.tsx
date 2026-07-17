"use client";

import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Asset } from "@/types/asset";

interface AssetTableProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

export function AssetTable({ assets, onEdit, onDelete }: AssetTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Asset inventory</h3>
          <p className="text-sm text-slate-600">Manage holdings and values</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ArrowUpDown className="h-4 w-4" />
          Sortable view
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Institution</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Current value</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{asset.asset_name}</td>
                <td className="px-4 py-3 text-slate-600">{asset.asset_type}</td>
                <td className="px-4 py-3 text-slate-600">{asset.institution ?? "—"}</td>
                <td className="px-4 py-3 text-slate-900">${asset.current_value.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-600">{asset.owner ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(asset)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(asset)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
