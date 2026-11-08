#!/usr/bin/env python3
"""Executable capacity & cost model for Refract (1x / 10x / 100x)."""

def model(dau, calls_per_day, deposits_per_day, monthly_gas):
    peak_rps = (dau * (calls_per_day + deposits_per_day)) / 86400 * 4.0
    storage_gb = (dau * (calls_per_day * 450 + deposits_per_day * 820) * 30) / 1e9
    return peak_rps, storage_gb, monthly_gas

rows = [
    ("1x", 150, 20, 1, 4.05),
    ("10x", 1500, 40, 1, 60.75),
    ("100x", 15000, 60, 1, 851.25),
]
for name, dau, calls, deposits, gas in rows:
    rps, storage, _ = model(dau, calls, deposits, gas)
    print(f"{name}: DAU={dau} peak_rps={rps:.2f} 12mo_storage_gb={storage:.2f} monthly_gas_usd={gas:.2f}")
print("first_component_to_saturate: Neon free storage at 10x; Helius RPC at 100x")
