// This file is a read-only, byte-for-byte copy of the JS body of active n8n node 'N5 v',
// wrapped as a callable ES module so the browser can preview the existing email design.
// No live workflow was changed. Do not casually change the template below.
// Rendered links and scripts are disabled by the browser preview frame before displaying.
export function renderExistingN5Proposal(input) {
  const $input = { all: () => [{ json: input }] };
  const output = (() => {
// --- Node 5: Final Proposal Assembly Engine ---
// Purpose:
// 1) Build the final rate card HTML.
// 2) Support Palletized + Floor-loaded inbound simultaneously.
// 3) Calculate all displayed revenue from the ACTUAL ROUNDED rates
//    shown on the rate card.
// 4) Ensure the logic sentence can always be reproduced with a calculator.

const items = $input.all();

return items.map(item => {

    const input = item.json;

    // ============================================================
    // 1. DATA SEGMENT MAPPING & BASE EXTRACTIONS
    // ============================================================

    const s1 = input.section_1_static || {};
    const s2 = input.section_2_inbound || {};
    const s3 = input.section_3_storage || {};
    const s4 = input.section_4_outbound || {};
    const s5 = input.section_5_misc || {};
    const yieldOpt = input.yield_optimization || {};

    const warehouseName =
        s1.selected_warehouse_name ||
        s1.Warehouse_name ||
        "Warehouse Partner";


    // ------------------------------------------------------------
    // Warehouse City / State
    // ------------------------------------------------------------

    const warehouseCity =
        s1.city ||
        input.city ||
        "";

    const warehouseState =
        s1.state ||
        input.state ||
        "";

    let cityStateSublineHtml = "";

    if (
        warehouseCity ||
        warehouseState
    ) {

        cityStateSublineHtml =
            `<div style="font-size:12px; color:#4A5568; margin-top:4px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${
                [
                    warehouseCity,
                    warehouseState
                ]
                .filter(Boolean)
                .join(", ")
            }</div>`;
    }


    const logoUrl =
        s1.logo_url;


    const hwkId =
        s1.Hwk_Id ||
        s1.Hwk_ID ||
        s1.hwk_id ||
        input.hwk_id ||
        "Unknown";


    const highResGoat =
        "https://raw.githubusercontent.com/SeanDottt/ScapeGoat/3fabb1c94b8fdb03ebd4ef2813f86fd674affa0f/logo.png";


    const currentRepName =
        s1.rep_name ||
        input.rep_name ||
        "Josh";


    const repEmailRoutingAddress =
        currentRepName
            .toLowerCase()
            .includes("sean")
                ? "sean@hawkishllc.com"
                : "josh@hawkishllc.com";


    // ============================================================
    // 2. HELPERS
    // ============================================================

    const toNumber = (
        value,
        fallback = 0
    ) => {

        const parsed =
            parseFloat(value);

        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    };


    const round2 = (value) => {

        return Number(
            toNumber(
                value,
                0
            ).toFixed(2)
        );
    };


    const fmt = (num) => {

        const value =
            toNumber(
                num,
                0
            );

        return `$${value.toLocaleString(
            undefined,
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )}`;
    };


    const formatLabel = (str) => {

        return str
            ? String(str)
                .replace(/_/g, " ")
                .toUpperCase()
            : "SERVICE";
    };


    const cleanAssumption = (value) => {

        return (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        )
            ? String(value).trim()
            : "";
    };


    const escapeHtml = (value) => {

        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };


    const row = (
        fieldName,
        cost,
        assumption
    ) => {

        return {
            field_name:
                fieldName,

            cost:
                round2(cost),

            assumption:
                cleanAssumption(
                    assumption
                )
        };
    };


    const getRowCost = (
        rows,
        fieldName,
        fallback = 0
    ) => {

        const found =
            rows.find(
                r =>
                    String(
                        r.field_name ||
                        ""
                    ).toLowerCase() ===
                    fieldName.toLowerCase()
            );

        return found
            ? round2(found.cost)
            : round2(fallback);
    };


    // ============================================================
    // 3. DETECT INBOUND TYPES
    // ============================================================

    const inboundTypeStr =
        (
            s2.inbound_type ||
            "Pallet"
        )
        .toString()
        .toLowerCase();


    let hasPallet =
        s2.has_pallet_in !== undefined
            ? Boolean(
                s2.has_pallet_in
            )
            : (
                inboundTypeStr.includes("pallet") ||
                inboundTypeStr.includes("plt")
            );


    let hasContainer =
        s2.has_container_unload !== undefined
            ? Boolean(
                s2.has_container_unload
            )
            : (
                inboundTypeStr.includes("floor") ||
                inboundTypeStr.includes("container")
            );


    if (
        !hasPallet &&
        !hasContainer
    ) {

        hasPallet =
            true;
    }


    // ============================================================
    // 4. TABLE ROW EXTRACTORS & SAFE FALLBACK RECOVERY
    // ============================================================

    let inTableRows =
        Array.isArray(
            input.section_2_inbound_rows
        )
            ? input.section_2_inbound_rows
            : [];


    let stTableRows =
        Array.isArray(
            input.section_3_storage_rows
        )
            ? input.section_3_storage_rows
            : [];


    let outTableRows =
        Array.isArray(
            input.section_4_outbound_rows
        )
            ? input.section_4_outbound_rows
            : [];


    let rawMiscTableRows =
        Array.isArray(
            input.section_5_misc_rows
        )
            ? input.section_5_misc_rows
            : [];


    const storageType =
        (
            s1.storage_type ||
            s3.storage_type ||
            "Pallet"
        )
        .toString()
        .toUpperCase();


    // ============================================================
    // FALLBACK RECOVERY: INBOUND
    // ============================================================

    if (
        !inTableRows ||
        inTableRows.length === 0
    ) {

        inTableRows = [];


        if (hasPallet) {

            inTableRows.push(
                row(
                    "inbound_pallet",

                    s2.r_in_pallet_new ||
                    s2.inbound_pallet ||
                    12,

                    s2.inbound_pallet_assumptions
                )
            );
        }


        if (hasContainer) {

            inTableRows.push(

                row(
                    "master_carton_in",

                    s2.r_in_container_new ||
                    s2.Master_Carton_In ||
                    0.68,

                    s2.Master_Carton_In_assumptions
                ),

                row(
                    "inbound_container_min",

                    s2.inbound_container_min_new ||
                    s2.inbound_container_min ||
                    750,

                    s2.inbound_container_min_assumptions
                )
            );
        }


        inTableRows.push(
            row(
                "sku_sort_fee",

                s2.sku_sort_fee,

                s2.sku_sort_fee_assumptions
            )
        );


        inTableRows =
            inTableRows.filter(
                r =>
                    r.cost > 0
            );
    }


    // ============================================================
    // FALLBACK RECOVERY: STORAGE
    // ============================================================

    if (
        !stTableRows ||
        stTableRows.length === 0
    ) {

        const isSQFT =
            storageType.includes("SQFT") ||
            storageType.includes("SQUARE");


        const fallbackRate =
            isSQFT
                ? toNumber(
                    s3.SQFT_rate_new ||
                    s3.SQFT_rate ||
                    s3.storage_pallet_base,
                    0
                )
                : toNumber(
                    s3.r_st_new ||
                    s3.storage_pallet_base_new ||
                    s3.storage_pallet_base,
                    0
                );


        stTableRows = [

            row(
                isSQFT
                    ? "SQFT_rate"
                    : "storage_pallet_base",

                fallbackRate,

                isSQFT
                    ? (
                        s3.SQFT_rate_assumptions ||
                        s3.storage_pallet_base_assumptions
                    )
                    : s3.storage_pallet_base_assumptions
            )
        ];
    }


    // ============================================================
    // FALLBACK RECOVERY: OUTBOUND
    // ============================================================

    if (
        !outTableRows ||
        outTableRows.length === 0
    ) {

        outTableRows = [];

        const dtcData =
            s4.DTC || {};

        const b2bData =
            s4.B2B || {};

        const palletData =
            s4.PalletOut || {};


        if (
            toNumber(
                dtcData.dtc_vol,
                0
            ) > 0
        ) {

            outTableRows.push(

                row(
                    "b2c_order_fee",
                    dtcData.b2c_order_fee || 2.20,
                    dtcData.b2c_order_fee_assumptions
                ),

                row(
                    "b2c_unit_pick",
                    dtcData.b2c_unit_pick || 0.30,
                    dtcData.b2c_unit_pick_assumptions
                )
            );


            if (
                dtcData.promotional_insert
            ) {

                outTableRows.push(
                    row(
                        "promotional_insert",
                        dtcData.promotional_insert,
                        dtcData.promotional_insert_assumptions
                    )
                );
            }


            if (
                dtcData.return_order_fee
            ) {

                outTableRows.push(
                    row(
                        "return_order_fee",
                        dtcData.return_order_fee,
                        dtcData.return_order_fee_assumptions
                    )
                );
            }


            if (
                dtcData.return_item_fee
            ) {

                outTableRows.push(
                    row(
                        "return_item_fee",
                        dtcData.return_item_fee,
                        dtcData.return_item_fee_assumptions
                    )
                );
            }
        }


        if (
            toNumber(
                b2bData.retail_vol,
                0
            ) > 0
        ) {

            outTableRows.push(

                row(
                    "b2b_order_fee",
                    b2bData.b2b_order_fee || 5,
                    b2bData.b2b_order_fee_assumptions
                ),

                row(
                    "b2b_carton_pick_fee",
                    b2bData.b2b_carton_pick_fee || 0.60,
                    b2bData.b2b_carton_pick_fee_assumptions
                )
            );
        }


        if (
            toNumber(
                palletData.pallet_vol,
                0
            ) > 0
        ) {

            outTableRows.push(

                row(
                    "b2b_pallet_out",
                    palletData.b2b_pallet_out || 12,
                    palletData.b2b_pallet_out_assumptions
                ),

                row(
                    "bol_fee",
                    palletData.bol_fee || 8,
                    palletData.bol_fee_assumptions
                )
            );
        }
    }


    // ============================================================
    // FALLBACK RECOVERY: MISC
    // ============================================================

    if (
        !rawMiscTableRows ||
        rawMiscTableRows.length === 0
    ) {

        [
            "pallet_supply_shrink_wrap",
            "hourly_labor",
            "it_support_hourly",
            "monthly_cart_fee",
            "labeling_fee"
        ]
        .forEach(
            field => {

                if (
                    s5[field]
                ) {

                    rawMiscTableRows.push(
                        row(
                            field,
                            s5[field],
                            s5[
                                `${field}_assumptions`
                            ]
                        )
                    );
                }
            }
        );
    }


    // ============================================================
    // MONTHLY MINIMUM
    // ============================================================

    const currentTargetFloor =
        toNumber(
            s5.monthly_minimum,
            1000
        );


    if (
        !rawMiscTableRows.some(
            r =>
                (
                    r.field_name ||
                    ""
                )
                .toLowerCase()
                .includes(
                    "minimum"
                )
        )
    ) {

        rawMiscTableRows.push(

            row(
                "monthly minimum",

                currentTargetFloor,

                s5.monthly_minimum_assumptions ||
                "Account contract baseline monthly floor minimum threshold."
            )
        );
    }

    else {

        rawMiscTableRows =
            rawMiscTableRows.map(
                r => {

                    if (
                        (
                            r.field_name ||
                            ""
                        )
                        .toLowerCase()
                        .includes(
                            "minimum"
                        )
                    ) {

                        return row(
                            "monthly minimum",

                            Math.max(
                                r.cost,
                                currentTargetFloor
                            ),

                            r.assumption
                        );
                    }

                    return r;
                }
            );
    }


    // ============================================================
    // SORT MISC
    // ============================================================

    const miscTableRows =
        [
            ...rawMiscTableRows
        ]
        .sort(
            (a, b) => {

                const nameA =
                    (
                        a.field_name ||
                        ""
                    )
                    .toLowerCase();

                const nameB =
                    (
                        b.field_name ||
                        ""
                    )
                    .toLowerCase();


                if (
                    nameA.includes(
                        "minimum"
                    )
                ) {
                    return -1;
                }


                if (
                    nameB.includes(
                        "minimum"
                    )
                ) {
                    return 1;
                }


                return 0;
            }
        );


    // ============================================================
    // 5. MATHEMATICAL SUMMARY ENGINE
    // ============================================================

    const palletInboundVol =
        toNumber(
            s2.pallet_avg_inbound_qty_per_month ||
            s2.pallet_monthly_inbound_vol ||
            s2.pallet_inbound_vol,
            (
                hasPallet &&
                !hasContainer
            )
                ? toNumber(
                    s2.monthly_inbound_vol,
                    0
                )
                : 0
        );


    const palletQtyPerInbound =
        toNumber(
            s2.pallet_avg_qty_per_inbound ||
            s2.pallet_qty_per_inbound,
            (
                hasPallet &&
                !hasContainer
            )
                ? toNumber(
                    s2.inbound_qty,
                    0
                )
                : 0
        );


    const containerInboundVol =
        toNumber(
            s2.container_avg_inbound_qty_per_month ||
            s2.container_monthly_inbound_vol ||
            s2.container_inbound_vol,
            (
                hasContainer &&
                !hasPallet
            )
                ? toNumber(
                    s2.monthly_inbound_vol,
                    0
                )
                : 0
        );


    const containerQtyPerInbound =
        toNumber(
            s2.container_avg_qty_per_inbound ||
            s2.container_qty_per_inbound,
            (
                hasContainer &&
                !hasPallet
            )
                ? toNumber(
                    s2.inbound_qty,
                    0
                )
                : 0
        );


    let inboundSegments = [];
    let inboundTotal = 0;


    // ------------------------------------------------------------
    // PALLETIZED INBOUND
    // ------------------------------------------------------------

    if (
        hasPallet &&
        palletInboundVol > 0
    ) {

        const palletRate =
            getRowCost(
                inTableRows,
                "inbound_pallet",

                s2.r_in_pallet_new ||
                s2.inbound_pallet ||
                12
            );


        const palletSubtotal =
            round2(
                palletInboundVol *
                palletQtyPerInbound *
                palletRate
            );


        inboundTotal =
            round2(
                inboundTotal +
                palletSubtotal
            );


        inboundSegments.push(
            `Palletized: ${palletInboundVol} inbounds × ${palletQtyPerInbound} pallets @ ${fmt(palletRate)}`
        );
    }


    // ------------------------------------------------------------
    // FLOOR-LOADED / CONTAINER INBOUND
    // ------------------------------------------------------------

    if (
        hasContainer &&
        containerInboundVol > 0
    ) {

        const cartonRate =
            getRowCost(
                inTableRows,
                "master_carton_in",

                s2.r_in_container_new ||
                s2.Master_Carton_In ||
                0.68
            );


        const containerMinimum =
            getRowCost(
                inTableRows,
                "inbound_container_min",

                s2.inbound_container_min_new ||
                s2.inbound_container_min ||
                750
            );


        const cartonCalculatedCharge =
            round2(
                containerQtyPerInbound *
                cartonRate
            );


        const chargePerContainer =
            round2(
                Math.max(
                    cartonCalculatedCharge,
                    containerMinimum
                )
            );


        const containerSubtotal =
            round2(
                containerInboundVol *
                chargePerContainer
            );


        inboundTotal =
            round2(
                inboundTotal +
                containerSubtotal
            );


        if (
            containerMinimum >
            cartonCalculatedCharge
        ) {

            inboundSegments.push(
                `Floor-loaded: ${containerInboundVol} containers × ${containerQtyPerInbound} cartons @ ${fmt(cartonRate)} = ${fmt(cartonCalculatedCharge)}/container; ${fmt(containerMinimum)} minimum applies`
            );
        }

        else {

            inboundSegments.push(
                `Floor-loaded: ${containerInboundVol} containers × ${containerQtyPerInbound} cartons @ ${fmt(cartonRate)}`
            );
        }
    }


    const fallbackInboundRevenue =
        round2(
            s2.inbound_revenue_new ||
            s2.inbound_revenue ||
            0
        );


    let inboundLogic;


    if (
        inboundSegments.length > 0
    ) {

        inboundLogic =
            `Logic: ${inboundSegments.join(" + ")} = <strong>${fmt(inboundTotal)} Est. Monthly</strong>`;
    }

    else {

        inboundLogic =
            `Logic: Inbound Operations = <strong>${fmt(fallbackInboundRevenue)} Est. Monthly</strong>`;
    }


    // ============================================================
    // STORAGE TEXT ENGINE
    // ============================================================

    const stVol =
        toNumber(
            s3.Storage_Qty ||
            s3.storage_pallet_equivalent,
            0
        );


    const isSqftStorage =
        storageType.includes("SQFT") ||
        storageType.includes("SQUARE");


    const storageFieldName =
        isSqftStorage
            ? "SQFT_rate"
            : "storage_pallet_base";


    const stRate =
        getRowCost(
            stTableRows,
            storageFieldName,

            s3.r_st_new ||
            s3.storage_pallet_base ||
            s3.SQFT_rate ||
            0
        );


    const explicitVisualStorageTotal =
        round2(
            stVol *
            stRate
        );


    const storageLogic =
        isSqftStorage

            ? `Logic: Space Allocation (${stVol.toLocaleString()} SQFT) × ${fmt(stRate)} per SQFT = <strong>${fmt(explicitVisualStorageTotal)} Est. Monthly</strong>`

            : `Logic: Static Space Inventory (${stVol.toLocaleString()} Pallets) × ${fmt(stRate)} Base Storage Rate = <strong>${fmt(explicitVisualStorageTotal)} Est. Monthly</strong>`;


    // ============================================================
    // OUTBOUND FREIGHT PROFILE ENGINE
    // ============================================================

    const dtcData =
        s4.DTC || {};

    const b2bData =
        s4.B2B || {};

    const pOutData =
        s4.PalletOut || {};


    let outboundSegments = [];
    let outboundTotal = 0;


    // ------------------------------------------------------------
    // DTC
    // ------------------------------------------------------------

    if (
        toNumber(
            dtcData.dtc_vol,
            0
        ) > 0
    ) {

        const orderVolume =
            toNumber(
                dtcData.dtc_vol,
                0
            );


        const unitsPerOrder =
            toNumber(
                dtcData.unit_per_order,
                0
            );


        const orderFee =
            getRowCost(
                outTableRows,
                "b2c_order_fee",

                dtcData.b2c_order_fee ||
                2.20
            );


        const pickFee =
            getRowCost(
                outTableRows,
                "b2c_unit_pick",

                dtcData.b2c_unit_pick ||
                0.30
            );


        const perOrderCharge =
            round2(
                orderFee +
                (
                    unitsPerOrder *
                    pickFee
                )
            );


        const segDtc =
            round2(
                orderVolume *
                perOrderCharge
            );


        outboundTotal =
            round2(
                outboundTotal +
                segDtc
            );


        outboundSegments.push(
            `DTC: ${orderVolume} orders × (${fmt(orderFee)} order + ${unitsPerOrder} units × ${fmt(pickFee)})`
        );
    }


    // ------------------------------------------------------------
    // B2B
    // ------------------------------------------------------------

    if (
        toNumber(
            b2bData.retail_vol,
            0
        ) > 0
    ) {

        const orderVolume =
            toNumber(
                b2bData.retail_vol,
                0
            );


        const casesPerOrder =
            toNumber(
                b2bData.cases_per_order,
                0
            );


        const skusPerOrder =
            toNumber(
                b2bData.sku_per_order,
                0
            );


        const orderFee =
            getRowCost(
                outTableRows,
                "b2b_order_fee",

                b2bData.b2b_order_fee ||
                5
            );


        const cartonFee =
            getRowCost(
                outTableRows,
                "b2b_carton_pick_fee",

                b2bData.b2b_carton_pick_fee ||
                0.60
            );


        const perOrderCharge =
            round2(
                orderFee +
                (
                    casesPerOrder *
                    cartonFee
                )
            );


        const segB2b =
            round2(
                orderVolume *
                perOrderCharge
            );


        outboundTotal =
            round2(
                outboundTotal +
                segB2b
            );


        const skuText =
            skusPerOrder > 0
                ? `, ${skusPerOrder} SKUs/order`
                : "";


        outboundSegments.push(
            `B2B: ${orderVolume} orders (${casesPerOrder} cases/order${skuText}) × (${fmt(orderFee)} + ${casesPerOrder} × ${fmt(cartonFee)})`
        );
    }


    // ------------------------------------------------------------
    // PALLET OUT
    // ------------------------------------------------------------

    if (
        toNumber(
            pOutData.pallet_vol,
            0
        ) > 0
    ) {

        const shipmentVolume =
            toNumber(
                pOutData.pallet_vol,
                0
            );


        const palletsPerOrder =
            toNumber(
                pOutData.pallets_per_order,
                0
            );


        const palletFee =
            getRowCost(
                outTableRows,
                "b2b_pallet_out",

                pOutData.b2b_pallet_out ||
                12
            );


        const bolFee =
            getRowCost(
                outTableRows,
                "bol_fee",

                pOutData.bol_fee ||
                8
            );


        const perShipmentCharge =
            round2(
                (
                    palletsPerOrder *
                    palletFee
                ) +
                bolFee
            );


        const segPallet =
            round2(
                shipmentVolume *
                perShipmentCharge
            );


        outboundTotal =
            round2(
                outboundTotal +
                segPallet
            );


        outboundSegments.push(
            `Pallet Out: ${shipmentVolume} shipments (${palletsPerOrder} pallets/order) × (${palletsPerOrder} × ${fmt(palletFee)} + ${fmt(bolFee)} BOL)`
        );
    }


    let outboundLogic;


    if (
        outboundSegments.length > 0
    ) {

        outboundLogic =
            `Logic: ${outboundSegments.join(" | ")} = <strong>${fmt(outboundTotal)} Est. Monthly</strong>`;
    }

    else {

        outboundLogic =
            `Logic: Distribution Freight Profile Summary Allocation = <strong>$0.00 Est. Monthly</strong>`;
    }


    // ============================================================
    // 6. RENDER DYNAMIC TABLE ROWS
    // ============================================================

    function generateTableRows(rows) {

        if (
            !rows ||
            rows.length === 0
        ) {

            return "";
        }


        return rows
            .map(
                itemRow => {

                    return `<tr>
                        <td style="padding:14px 12px;font-weight:700;color:#1A202C;font-size:11px;border-bottom:2px solid #1A202C;letter-spacing:0.5px;width:55%;text-align:left;">${escapeHtml(formatLabel(itemRow.field_name))}</td>

                        <td style="padding:14px 12px;font-weight:900;color:#1A202C;font-size:14px;border-bottom:2px solid #1A202C;text-align:center;width:20%;">${fmt(itemRow.cost)}</td>

                        <td style="padding:14px 12px;color:#718096;font-size:10px;border-bottom:2px solid #1A202C;line-height:1.4;font-weight:500;width:25%;text-align:left;">${escapeHtml(itemRow.assumption)}</td>
                    </tr>`;
                }
            )
            .join("");
    }


    // ============================================================
    // 7. STRUCTURAL SECTIONS BUNDLING CONFIG
    // ============================================================

    const sections = [

        {
            label:
                "Inbound Operations",

            data:
                inTableRows,

            logic:
                inboundLogic
        },

        {
            label:
                "Storage & Inventory",

            data:
                stTableRows,

            logic:
                storageLogic
        },

        {
            label:
                "Outbound Fulfillment",

            data:
                outTableRows,

            logic:
                outboundLogic
        },

        {
            label:
                "Administrative & Misc",

            data:
                miscTableRows,

            logic:
                "Logic: Administrative and misc line items shown below."
        }
    ];


    // ============================================================
    // 8. MASTER HTML TEMPLATE CONSTRUCTOR
    // ============================================================

    const renderedHtml =
        `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rate Card Proposal</title>
        </head>

        <body style="margin:0;padding:40px 0;background-color:#f7f9fa;font-family:Arial,sans-serif;-webkit-font-smoothing:antialiased;">

        <center>

        <table
            width="100%"
            border="0"
            cellpadding="0"
            cellspacing="0"
            style="
                max-width:620px;
                width:100%;
                background-color:#ffffff;
                border:4px solid #1A202C;
                box-shadow:12px 12px 0px rgba(26,32,44,0.06);
                text-align:left;
            "
        >

        <tr>
        <td
            style="
                padding:40px;
                border-bottom:4px solid #1A202C;
                background-color:#ffffff;
            "
        >

        <table
            width="100%"
            border="0"
            cellpadding="0"
            cellspacing="0"
        >

        <tr>

        <td
            align="left"
            style="vertical-align:middle;"
        >

        ${
            logoUrl
                ? `<img
                    src="${escapeHtml(logoUrl)}"
                    height="45"
                    border="0"
                    style="display:block;"
                  >`

                : `<h1
                    style="
                        font-size:28px;
                        color:#1A202C;
                        margin:0;
                        font-weight:900;
                        letter-spacing:-1px;
                        text-transform:uppercase;
                    "
                  >${escapeHtml(warehouseName)}</h1>`
        }

        ${cityStateSublineHtml}

        <div
            style="
                margin-top:10px;
                background:#1A202C;
                color:#ffffff;
                display:inline-block;
                padding:4px 10px;
                font-size:10px;
                font-weight:800;
                letter-spacing:2px;
            "
        >
            REF ID: ${escapeHtml(hwkId)}
        </div>

        </td>


        <td
            align="right"
            width="85"
            style="vertical-align:middle;"
        >

        <table
            border="0"
            cellpadding="0"
            cellspacing="0"
            style="
                border:2px solid #1A202C;
                box-shadow:5px 5px 0px #FF4B01;
                background:#ffffff;
            "
        >

        <tr>

        <td style="padding:6px;">

        <img
            src="${highResGoat}"
            width="60"
            border="0"
            style="
                display:block;
                width:60px;
            "
        >

        </td>

        </tr>

        </table>

        </td>

        </tr>

        </table>

        </td>

        </tr>


        <tr>

        <td style="padding:40px 25px 20px 25px;">


        ${
            sections
                .map(
                    section => {

                        return `
                        <div style="margin-bottom:45px;">

                            <div
                                style="
                                    border-left:6px solid #FF4B01;
                                    padding-left:15px;
                                    margin-bottom:18px;
                                "
                            >

                                <h2
                                    style="
                                        font-size:14px;
                                        letter-spacing:2px;
                                        text-transform:uppercase;
                                        margin:0;
                                        color:#1A202C;
                                        font-weight:900;
                                    "
                                >
                                    ${escapeHtml(section.label)}
                                </h2>

                                <div
                                    style="
                                        margin-top:8px;
                                        padding:12px;
                                        border:2px solid #1A202C;
                                        font-size:11px;
                                        font-weight:700;
                                        box-shadow:5px 5px 0px #1A202C;
                                        background:#ffffff;
                                        color:#2D3748;
                                        line-height:1.5;
                                    "
                                >
                                    • ${section.logic}
                                </div>

                            </div>


                            <table
                                width="100%"
                                border="0"
                                cellpadding="0"
                                cellspacing="0"
                                style="
                                    width:100%;
                                    border:2px solid #1A202C;
                                    border-collapse:collapse;
                                    margin-top:10px;
                                "
                            >
                                ${generateTableRows(section.data)}
                            </table>

                        </div>
                        `;
                    }
                )
                .join("")
        }


        <div
            style="
                margin-top:55px;
                padding:25px;
                border:4px solid #1A202C;
                box-shadow:8px 8px 0px #FF4B01;
                background-color:#ffffff;
            "
        >

        <h3
            style="
                margin:0 0 15px 0;
                font-size:13px;
                text-transform:uppercase;
                border-bottom:2px solid #FF4B01;
                display:inline-block;
                color:#1A202C;
                font-weight:900;
                letter-spacing:1px;
            "
        >
            Guardrails
        </h3>


        <p
            style="
                font-size:12px;
                font-weight:700;
                margin:0 0 10px 0;
                color:#1A202C;
            "
        >
            Validity: Official Quote valid for 30 days.
        </p>


        <p
            style="
                font-size:11px;
                color:#718096;
                line-height:1.6;
                margin:0;
            "
        >

            <strong>90-Day Performance Audit:</strong>

            We will conduct a volume review at 90 days to ensure
            your account is placed in the most accurate pricing
            tier based on actual activity.

            Effective Day 91, your rates will automatically align
            with these verified volume levels to reflect your
            current scale.

        </p>

        </div>


        <div
            style="
                margin-top:55px;
                text-align:center;
                margin-bottom:20px;
            "
        >

        <a
            href="https://seanskin.app.n8n.cloud/webhook/bf36f171-cfe7-4262-a74c-52afac05c668?hwk_id=${encodeURIComponent(hwkId)}"

            style="
                background-color:#FF4B01;
                color:#ffffff;
                text-decoration:none;
                padding:16px 40px;
                font-weight:800;
                font-size:15px;
                border:3px solid #1A202C;
                box-shadow:6px 6px 0px #1A202C;
                display:inline-block;
                text-transform:uppercase;
                letter-spacing:1px;
            "
        >
            Let's Move Forward
        </a>

        </div>


        </td>

        </tr>

        </table>

        </center>

        </body>

        </html>`;


    // ============================================================
    // 9. OUTPUT
    // ============================================================

    return {

        html_body:
            renderedHtml,

        hwk_id:
            hwkId,

        lead_email:
            input.lead_email ||
            s1.lead_email ||
            input.email ||
            "",

        sales_email:
            s1.sales_email ||
            s1.rep_name ||
            input.sales_email ||
            input.rep_name ||
            "N/A",

        rounded_rate_revenue: {

            inbound:
                round2(
                    inboundSegments.length > 0
                        ? inboundTotal
                        : fallbackInboundRevenue
                ),

            storage:
                explicitVisualStorageTotal,

            outbound:
                outboundTotal,

            total_variable_revenue:
                round2(
                    (
                        inboundSegments.length > 0
                            ? inboundTotal
                            : fallbackInboundRevenue
                    ) +
                    explicitVisualStorageTotal +
                    outboundTotal
                )
        }
    };
});
  })();
  return output[0];
}
