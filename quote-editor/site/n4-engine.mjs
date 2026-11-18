// Frozen production N4 vSean.1 copied from workflow XKbLZ6d9WfF1pRpN.
// Version pinned for isolated quote-editor reprice; does not change live n8n.
export function runN4(source){
 const $input={first:()=>({json:source})};
 const result=(()=>{
// Node 4: Rate Card Synchronizer & Structural Row Mapping
// Purpose: Builds table rows using dynamic rates while preserving Supabase assumptions only.

const input = $input.first().json;

const s1 = input.section_1_static || {};
const s2 = input.section_2_inbound || {};
const s3 = input.section_3_storage || {};
const s4 = input.section_4_outbound || {};
const s5 = input.section_5_misc || {};

const opt = input.yield_optimization || {};
const isOptimized = opt.needs_optimization === true;
const M = parseFloat(opt.multiplier_M) || 1;
const isFloorLocked = s2.is_container_floor_applied === true;

// ------------------------------------------
// Helpers
// ------------------------------------------
const toNumber = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (value) => {
    return Number(toNumber(value, 0).toFixed(2));
};

const cleanAssumption = (value) => {
    return (value !== undefined && value !== null && value.toString().trim() !== "")
        ? value.toString().trim()
        : "";
};

// ------------------------------------------
// Optimized inbound rates from N3
// ------------------------------------------
const originalInboundPallet = toNumber(input.new_rate_card?.inbound_pallet_original, toNumber(s2.inbound_pallet, 0));
const originalMasterCarton = toNumber(input.new_rate_card?.Master_Carton_In_original, toNumber(s2.Master_Carton_In, 0));
const originalContainerMin = toNumber(input.new_rate_card?.inbound_container_min_original, toNumber(s2.inbound_container_min, 750));

const n3PalletRate = parseFloat(s2.r_in_pallet_new);
const n3ContainerRate = parseFloat(s2.r_in_container_new);
const n3ContainerMinRate = parseFloat(s2.inbound_container_min_new);
const n3InboundRate = parseFloat(s2.r_in_new);

const finalInboundPalletRate = round2(
    isOptimized 
        ? (Number.isFinite(n3PalletRate) ? n3PalletRate : (Number.isFinite(n3InboundRate) ? n3InboundRate : originalInboundPallet * M)) 
        : originalInboundPallet
);

const finalMasterCartonRate = round2(
    isOptimized && !isFloorLocked
        ? (Number.isFinite(n3ContainerRate) ? n3ContainerRate : (Number.isFinite(n3InboundRate) ? n3InboundRate : originalMasterCarton * M))
        : originalMasterCarton
);

const finalContainerMinRate = round2(
    isOptimized
        ? (Number.isFinite(n3ContainerMinRate) ? n3ContainerMinRate : originalContainerMin * M)
        : originalContainerMin
);

// ------------------------------------------
// 1. Inbound Rows (Multi-Type Support)
// ------------------------------------------
const inboundTypeStr = (s2.inbound_type || "").toString().toLowerCase();

let hasPallet = s2.has_pallet_in !== undefined 
    ? s2.has_pallet_in 
    : (inboundTypeStr.includes("pallet") || inboundTypeStr.includes("plt"));

let hasContainer = s2.has_container_unload !== undefined 
    ? s2.has_container_unload 
    : (inboundTypeStr.includes("floor") || inboundTypeStr.includes("container"));

if (!hasPallet && !hasContainer) {
    hasPallet = true;
}

let inboundRows = [];

if (hasPallet) {
    inboundRows.push({ 
        field_name: "inbound_pallet", 
        cost: finalInboundPalletRate, 
        assumption: cleanAssumption(s2.inbound_pallet_assumptions) 
    });
}

if (hasContainer) {
    inboundRows.push(
        { field_name: "master_carton_in", cost: finalMasterCartonRate, assumption: cleanAssumption(s2.Master_Carton_In_assumptions) },
        { field_name: "inbound_container_min", cost: finalContainerMinRate, assumption: cleanAssumption(s2.inbound_container_min_assumptions) }
    );
}

inboundRows.push({ 
    field_name: "sku_sort_fee", 
    cost: round2(toNumber(s2.sku_sort_fee, 0)), 
    assumption: cleanAssumption(s2.sku_sort_fee_assumptions) 
});

inboundRows = inboundRows.filter(row => row.cost > 0);

// ------------------------------------------
// 2. Storage Rows
// ------------------------------------------
const storageType = (s3.storage_type || s1.storage_type || "Pallet").toString().toUpperCase();
const isSqftStorage = storageType.includes("SQFT") || storageType.includes("SQUARE");

const originalStorageBase = toNumber(s3.storage_pallet_base, toNumber(s3.SQFT_rate, 0));
const n3StorageRate = parseFloat(s3.r_st_new);
const rateCardStorageRate = isSqftStorage ? input.new_rate_card?.SQFT_rate_new : input.new_rate_card?.storage_pallet_base_new;

const currentStorageBase = round2(Number.isFinite(n3StorageRate) ? n3StorageRate : toNumber(rateCardStorageRate, originalStorageBase));
const currentLongterm = round2(currentStorageBase * 1.5);

let storageRows = [];

if (isSqftStorage) {
    storageRows = [{ field_name: "SQFT_rate", cost: currentStorageBase, assumption: cleanAssumption(s3.SQFT_rate_assumptions || s3.storage_pallet_base_assumptions) }];
} else {
    storageRows = [
        { field_name: "storage_pallet_base", cost: currentStorageBase, assumption: cleanAssumption(s3.storage_pallet_base_assumptions) },
        { field_name: "storage_pallet_longterm", cost: currentLongterm, assumption: cleanAssumption(s3.storage_pallet_longterm_assumptions) }
    ];
}

storageRows = storageRows.filter(row => row.cost > 0);

// ------------------------------------------
// 3. Outbound Rows
// ------------------------------------------
const dtcData = s4.DTC || {};
const b2bData = s4.B2B || {};
const pOutData = s4.PalletOut || {};

const dtcVol = toNumber(dtcData.dtc_vol, 0);
const retailVol = toNumber(b2bData.retail_vol, 0);
const palletOutVol = toNumber(pOutData.pallet_vol, 0);

let outboundRows = [];

if (dtcVol > 0) {
    outboundRows.push(
        { field_name: "b2c_order_fee", cost: round2(toNumber(dtcData.b2c_order_fee, 2.20)), assumption: cleanAssumption(dtcData.b2c_order_fee_assumptions) },
        { field_name: "b2c_unit_pick", cost: round2(toNumber(dtcData.b2c_unit_pick, 0.30)), assumption: cleanAssumption(dtcData.b2c_unit_pick_assumptions) },
        { field_name: "promotional_insert", cost: round2(toNumber(dtcData.promotional_insert, 0.10)), assumption: cleanAssumption(dtcData.promotional_insert_assumptions) }
    );

    if (dtcData.return_order_fee !== undefined && dtcData.return_order_fee !== null) {
        outboundRows.push({
            field_name: "b2c_return_fee",
            cost: round2(toNumber(dtcData.return_order_fee, 0)),
            assumption: cleanAssumption(dtcData.return_order_fee_assumptions)
        });
    }
}

if (retailVol > 0) {
    outboundRows.push(
        { field_name: "b2b_order_fee", cost: round2(toNumber(b2bData.b2b_order_fee, 5.00)), assumption: cleanAssumption(b2bData.b2b_order_fee_assumptions) },
        { field_name: "b2b_carton_pick_fee", cost: round2(toNumber(b2bData.b2b_carton_pick_fee, 0.60)), assumption: cleanAssumption(b2bData.b2b_carton_pick_fee_assumptions) }
    );
}

if (palletOutVol > 0 || retailVol > 0) {
    const finalPalletOutFee = round2(toNumber(pOutData.b2b_pallet_out, toNumber(b2bData.b2b_pallet_out, toNumber(s4.b2b_pallet_out, 12.00))));
    const finalBolFee = round2(toNumber(pOutData.bol_fee, toNumber(b2bData.bol_fee, toNumber(s4.bol_fee, 8.00))));

    outboundRows.push(
        { field_name: "b2b_pallet_out", cost: finalPalletOutFee, assumption: cleanAssumption(pOutData.b2b_pallet_out_assumptions || b2bData.b2b_pallet_out_assumptions) },
        { field_name: "bol_fee", cost: finalBolFee, assumption: cleanAssumption(pOutData.bol_fee_assumptions || b2bData.bol_fee_assumptions) }
    );
}

outboundRows = outboundRows.filter(row => row.cost > 0 || row.field_name.includes("return"));

// ------------------------------------------
// 4. Misc Rows (Injects Dynamic Minimum Row)
// ------------------------------------------
const miscRows = [
    { field_name: "pallet_supply_shrink_wrap", cost: round2(toNumber(s5.pallet_supply_shrink_wrap, 0)), assumption: cleanAssumption(s5.pallet_supply_shrink_wrap_assumptions) },
    { field_name: "hourly_labor", cost: round2(toNumber(s5.hourly_labor, 0)), assumption: cleanAssumption(s5.hourly_labor_assumptions) },
    { field_name: "it_support_hourly", cost: round2(toNumber(s5.it_support_hourly, 0)), assumption: cleanAssumption(s5.it_support_hourly_assumptions) },
    { field_name: "monthly_cart_fee", cost: round2(toNumber(s5.monthly_cart_fee, 0)), assumption: cleanAssumption(s5.monthly_cart_fee_assumptions) }
];

if (s5.labeling_fee !== undefined && s5.labeling_fee !== null) {
    miscRows.push({
        field_name: "labeling_fee",
        cost: round2(toNumber(s5.labeling_fee, 0)),
        assumption: cleanAssumption(s5.labeling_fee_assumptions)
    });
}

let cleanedMiscRows = miscRows.filter(row => row.cost > 0 || row.field_name === "labeling_fee");

// DYNAMIC 80% PROTECTION INJECTION
const evaluatedMinimum = round2(toNumber(opt.dynamic_floor, 1000));
const approvedFloorAssumption = cleanAssumption(s5.monthly_minimum_assumptions) || "Minimum monthly billed amount";

if (!cleanedMiscRows.some(r => (r.field_name || "").toLowerCase().includes("minimum"))) {
    cleanedMiscRows.push({
        field_name: "monthly_minimum",
        cost: evaluatedMinimum,
        assumption: approvedFloorAssumption
    });
}

// ------------------------------------------
// 5. Section Objects Packaging
// ------------------------------------------
const synchronizedInbound = {
    ...s2,
    inbound_pallet: finalInboundPalletRate,
    Master_Carton_In: finalMasterCartonRate,
    inbound_container_min: finalContainerMinRate,
    inbound_container_min_new: finalContainerMinRate,
    r_in_pallet_new: finalInboundPalletRate,
    r_in_container_new: finalMasterCartonRate,
    r_in_new: hasContainer ? finalMasterCartonRate : finalInboundPalletRate
};

const synchronizedStorage = {
    ...s3,
    storage_pallet_base: currentStorageBase,
    r_st_new: currentStorageBase,
    storage_pallet_longterm: isSqftStorage ? s3.storage_pallet_longterm : currentLongterm,
    storage_pallet_longterm_new: isSqftStorage ? s3.storage_pallet_longterm_new : currentLongterm
};

if (isSqftStorage) synchronizedStorage.SQFT_rate = currentStorageBase;

const finalNewRateCard = {
    ...(input.new_rate_card || {}),
    inbound_pallet_original: round2(originalInboundPallet),
    inbound_pallet_new: finalInboundPalletRate,
    Master_Carton_In_original: round2(originalMasterCarton),
    Master_Carton_In_new: finalMasterCartonRate,
    inbound_container_min_original: round2(originalContainerMin),
    inbound_container_min_new: finalContainerMinRate
};

if (isSqftStorage) {
    finalNewRateCard.SQFT_rate_original = round2(originalStorageBase);
    finalNewRateCard.SQFT_rate_new = currentStorageBase;
} else {
    finalNewRateCard.storage_pallet_base_original = round2(originalStorageBase);
    finalNewRateCard.storage_pallet_base_new = currentStorageBase;
    finalNewRateCard.storage_pallet_longterm_original = round2(toNumber(s3.storage_pallet_longterm, originalStorageBase * 1.5));
    finalNewRateCard.storage_pallet_longterm_new = currentLongterm;
}

return [{
    json: {
        section_1_static: s1,
        section_2_inbound: synchronizedInbound,
        section_3_storage: synchronizedStorage,
        section_4_outbound: s4,
        section_5_misc: s5,
        section_2_inbound_rows: inboundRows,
        section_3_storage_rows: storageRows,
        section_4_outbound_rows: outboundRows,
        section_5_misc_rows: cleanedMiscRows,
        total_monthly_revenue: round2(toNumber(input.total_monthly_revenue, toNumber(opt.final_revenue, 0))),
        yield_optimization: opt,
        new_rate_card: finalNewRateCard,
        missing_fields: input.missing_fields || null,
        quote_summary: input.quote_summary || ""
    }
}];
 })();
 if(!Array.isArray(result)||!result[0]?.json)throw Error("Production engine returned no quote");
 return result[0].json;
}
