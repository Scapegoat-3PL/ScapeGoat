// Frozen production N3 vSean.1 copied from workflow XKbLZ6d9WfF1pRpN.
// Version pinned for isolated quote-editor reprice; does not change live n8n.
export function runN3(source){
 const $input={first:()=>({json:source})};
 const result=(()=>{
// Node 3: Quote Yield — Weighted, Bidirectional RPP Optimization
// Purpose:
// 1) Dynamically adjust Inbound + Storage + Outbound pricing.
// 2) Weight adjustments toward the categories with the greatest modeled revenue impact.
// 3) Move pricing UP or DOWN to the warehouse target RPP.
// 4) Preserve a -30% downside guardrail while allowing unlimited upward pricing.
// 5) Calculate FINAL revenue from the ACTUAL ROUNDED billable rates shown on the rate card.
// 6) Keep admin/misc fees OUT of RPP while still preserving them in total billing revenue.

const input = $input.first().json;

const s1 = input.section_1_static || {};
const s2 = input.section_2_inbound || {};
const s3 = input.section_3_storage || {};
const s4 = input.section_4_outbound || {};
const s5 = input.section_5_misc || {};

const missing = [];

// ================================================================
// CONFIG
// ================================================================

const MAX_RATE_DECREASE = 0.30; // Rates may decrease by no more than 30%
                                // Upward adjustments are uncapped

const IMPACT_POWER = 1.25;      // 1.0 = pure revenue share; >1 favors larger-impact categories
const EPSILON = 0.01;


const num = (v, fallback = 0) => {

    const n =
        parseFloat(v);

    return Number.isFinite(n)
        ? n
        : fallback;
};


const round2 = (v) =>
    Number(
        num(v, 0)
            .toFixed(2)
    );


const clamp = (v, min, max) =>
    Math.min(
        Math.max(v, min),
        max
    );


const totalPEQ =
    num(
        s1.storage_pallet_equivalent,

        num(
            s3.storage_pallet_equivalent,

            num(
                s3.Storage_Qty,
                0
            )
        )
    );


const targetRPP =
    num(
        s1.Warehouse_rpp,
        0
    );


const leadRPP =
    num(
        s1.Lead_rpp,
        0
    );


if (
    targetRPP === 0
) {

    missing.push(
        "Warehouse_rpp"
    );
}


if (
    totalPEQ === 0
) {

    missing.push(
        "storage_pallet_equivalent"
    );
}



// ================================================================
// STEP 1: INBOUND BASELINE
// ================================================================

const inboundTypeStr =
    String(
        s2.inbound_type ||
        ""
    )
    .toLowerCase();


let hasPallet =
    s2.has_pallet_in !== undefined

        ? Boolean(
            s2.has_pallet_in
        )

        : (
            inboundTypeStr.includes(
                "pallet"
            ) ||

            inboundTypeStr.includes(
                "plt"
            )
        );


let hasContainer =
    s2.has_container_unload !== undefined

        ? Boolean(
            s2.has_container_unload
        )

        : (
            inboundTypeStr.includes(
                "floor"
            ) ||

            inboundTypeStr.includes(
                "container"
            )
        );


if (
    !hasPallet &&
    !hasContainer
) {

    hasPallet =
        true;
}


// ------------------------------------------------
// ORIGINAL INBOUND RATES
// ------------------------------------------------

const rInPalletOrig =
    num(
        s2.inbound_pallet,
        12
    );


const rInCartonOrig =
    num(
        s2.Master_Carton_In,
        0.68
    );


const rInContainerMinOrig =
    num(
        s2.inbound_container_min,
        750
    );



// ------------------------------------------------
// PRESERVE PALLET + CONTAINER VOLUMES SEPARATELY
//
// Generic monthly_inbound_vol / inbound_qty remain
// fallback fields for single-type opportunities.
// ------------------------------------------------

const palletInboundVol =
    num(
        s2.pallet_avg_inbound_qty_per_month,

        num(
            s2.pallet_monthly_inbound_vol,

            num(
                s2.pallet_inbound_vol,

                (
                    hasPallet &&
                    !hasContainer
                )

                    ? num(
                        s2.monthly_inbound_vol,
                        0
                    )

                    : 0
            )
        )
    );


const palletQtyPerInbound =
    num(
        s2.pallet_avg_qty_per_inbound,

        num(
            s2.pallet_qty_per_inbound,

            (
                hasPallet &&
                !hasContainer
            )

                ? num(
                    s2.inbound_qty,
                    0
                )

                : 0
        )
    );


const containerInboundVol =
    num(
        s2.container_avg_inbound_qty_per_month,

        num(
            s2.container_monthly_inbound_vol,

            num(
                s2.container_inbound_vol,

                (
                    hasContainer &&
                    !hasPallet
                )

                    ? num(
                        s2.monthly_inbound_vol,
                        0
                    )

                    : 0
            )
        )
    );


const containerQtyPerInbound =
    num(
        s2.container_avg_qty_per_inbound,

        num(
            s2.container_qty_per_inbound,

            (
                hasContainer &&
                !hasPallet
            )

                ? num(
                    s2.inbound_qty,
                    0
                )

                : 0
        )
    );



// ------------------------------------------------
// ORIGINAL PALLETIZED REVENUE
// ------------------------------------------------

const originalPalletRevenue = (

    hasPallet &&

    palletInboundVol > 0 &&

    palletQtyPerInbound > 0
)

    ? round2(

        palletInboundVol *

        palletQtyPerInbound *

        rInPalletOrig
    )

    : 0;



// ------------------------------------------------
// ORIGINAL FLOOR-LOADED REVENUE
// ------------------------------------------------

const originalContainerCartonCharge =
    round2(

        containerQtyPerInbound *

        rInCartonOrig
    );


const originalContainerChargePerInbound =
    Math.max(

        originalContainerCartonCharge,

        rInContainerMinOrig
    );


const originalContainerRevenue = (

    hasContainer &&

    containerInboundVol > 0 &&

    containerQtyPerInbound > 0
)

    ? round2(

        containerInboundVol *

        originalContainerChargePerInbound
    )

    : 0;



const calculatedInboundOperationalRevenue =
    round2(

        originalPalletRevenue +

        originalContainerRevenue
    );


const storedInboundRevenue =
    num(
        s2.inbound_revenue,
        0
    );


const calculatedInboundFallback =
    round2(

        num(
            s2.inbound_pallet_revenue,
            0
        ) +

        num(
            s2.inbound_container_revenue,
            0
        )
    );


// Prefer operational math when possible because
// the rate card can reproduce this exact amount.

const R_inbound_nat =
    calculatedInboundOperationalRevenue > 0

        ? calculatedInboundOperationalRevenue

        : (
            storedInboundRevenue > 0

                ? storedInboundRevenue

                : calculatedInboundFallback
        );



// ------------------------------------------------
// IS CONTAINER MINIMUM OPERATIVE?
// ------------------------------------------------

const isContainerFloorApplied =
    Boolean(

        hasContainer &&

        containerInboundVol > 0 &&

        containerQtyPerInbound > 0 &&

        originalContainerCartonCharge <
            rInContainerMinOrig
    );



// ================================================================
// STEP 2: STORAGE BASELINE
// ================================================================

const storageType =
    String(
        s3.storage_type ||
        "Pallet"
    )
    .toUpperCase();


const isSqftStorage =
    storageType.includes(
        "SQFT"
    ) ||

    storageType.includes(
        "SQUARE"
    );


const rStorageOrig =
    num(

        isSqftStorage

            ? (
                s3.SQFT_rate ||
                s3.storage_pallet_base
            )

            : s3.storage_pallet_base,

        16
    );


const storageQtyRaw =
    num(

        s3.Storage_Qty,

        num(
            s3.storage_qty_raw,
            totalPEQ
        )
    );


const calculatedStorageRevenue =
    round2(

        isSqftStorage

            ? storageQtyRaw *
                rStorageOrig

            : totalPEQ *
                rStorageOrig
    );


const storedStorageRevenue =
    num(
        s3.storage_revenue,
        0
    );


const R_storage_nat =
    calculatedStorageRevenue > 0

        ? calculatedStorageRevenue

        : storedStorageRevenue;



// ================================================================
// STEP 3: OUTBOUND BASELINE
// ================================================================

const dtcData =
    s4.DTC || {};


const b2bData =
    s4.B2B || {};


const palletData =
    s4.PalletOut || {};



// ------------------------------------------------
// DTC
// ------------------------------------------------

const dtcVol =
    num(
        dtcData.dtc_vol,
        0
    );


const dtcUnitsPerOrder =
    num(
        dtcData.unit_per_order,
        0
    );


const dtcOrderFeeOrig =
    num(
        dtcData.b2c_order_fee,
        0
    );


const dtcPickFeeOrig =
    num(
        dtcData.b2c_unit_pick,
        0
    );


const calculatedDtcRevenue =
    round2(

        dtcVol *

        (
            dtcOrderFeeOrig +

            (
                dtcUnitsPerOrder *

                dtcPickFeeOrig
            )
        )
    );



// ------------------------------------------------
// B2B
// ------------------------------------------------

const b2bVol =
    num(
        b2bData.retail_vol,
        0
    );


const b2bCasesPerOrder =
    num(
        b2bData.cases_per_order,
        0
    );


const b2bOrderFeeOrig =
    num(
        b2bData.b2b_order_fee,
        0
    );


const b2bCartonFeeOrig =
    num(
        b2bData.b2b_carton_pick_fee,
        0
    );


const calculatedB2bRevenue =
    round2(

        b2bVol *

        (
            b2bOrderFeeOrig +

            (
                b2bCasesPerOrder *

                b2bCartonFeeOrig
            )
        )
    );



// ------------------------------------------------
// PALLET OUT
// ------------------------------------------------

const palletVol =
    num(
        palletData.pallet_vol,
        0
    );


const palletsPerOrder =
    num(
        palletData.pallets_per_order,
        0
    );


const palletOutFeeOrig =
    num(

        palletData.b2b_pallet_out,

        num(
            b2bData.b2b_pallet_out,
            0
        )
    );


const bolFeeOrig =
    num(

        palletData.bol_fee,

        num(
            b2bData.bol_fee,
            0
        )
    );


const calculatedPalletRevenue =
    round2(

        palletVol *

        (
            (
                palletsPerOrder *

                palletOutFeeOrig
            ) +

            bolFeeOrig
        )
    );



// ------------------------------------------------
// TOTAL OUTBOUND BASELINE
// ------------------------------------------------

const calculatedOutboundRevenue =
    round2(

        calculatedDtcRevenue +

        calculatedB2bRevenue +

        calculatedPalletRevenue
    );


const storedOutboundRevenue =
    num(
        s4.outbound_revenue,
        0
    );


const hasModeledOutbound =
    dtcVol > 0 ||

    b2bVol > 0 ||

    palletVol > 0;


// Prefer reproducible operational math whenever
// we have an outbound profile.

const R_outbound_nat =
    hasModeledOutbound

        ? calculatedOutboundRevenue

        : storedOutboundRevenue;



// ================================================================
// STEP 4: TARGET + BIDIRECTIONAL DELTA
// ================================================================

// ------------------------------------------------
// RPP EXCLUDES ADMIN / CART / MISC
// ------------------------------------------------

const adminRevenueExcludedFromRpp =
    num(
        s5.monthly_cart_fee,
        0
    );


const R_variable_nat =
    round2(

        R_inbound_nat +

        R_storage_nat +

        R_outbound_nat
    );


const R_nat =
    R_variable_nat;


const R_nat_with_admin =
    round2(

        R_variable_nat +

        adminRevenueExcludedFromRpp
    );



// ------------------------------------------------
// TARGET RPP REVENUE
// ------------------------------------------------

const rppTargetRevenue =
    round2(

        totalPEQ *

        targetRPP
    );


// Monthly minimum remains a separate billing
// guardrail.
//
// It DOES NOT override the RPP target.

const dynamicTargetFloor =
    Math.max(

        1000,

        round2(

            rppTargetRevenue *

            0.80
        )
    );


const R_target =
    rppTargetRevenue;


const targetVariableRevenue =
    R_target;


const totalDelta =
    round2(

        targetVariableRevenue -

        R_variable_nat
    );


const needsOptimization =
    targetRPP > 0 &&

    Math.abs(
        totalDelta
    ) > EPSILON;


const direction =
    totalDelta > EPSILON

        ? "increase"

        : totalDelta < -EPSILON

            ? "decrease"

            : "none";



// ================================================================
// STEP 5: WEIGHTED CATEGORY ALLOCATION
//
// DOWNWARD: MAX -30%
// UPWARD: UNCAPPED
// ================================================================

const categories = [

    {
        key:
            "inbound",

        revenue:
            Math.max(
                0,
                R_inbound_nat
            ),

        eligible:
            R_inbound_nat > 0 &&

            (
                hasPallet ||
                hasContainer
            )
    },


    {
        key:
            "storage",

        revenue:
            Math.max(
                0,
                R_storage_nat
            ),

        eligible:
            R_storage_nat > 0 &&

            rStorageOrig > 0
    },


    {
        key:
            "outbound",

        revenue:
            Math.max(
                0,
                R_outbound_nat
            ),

        eligible:
            R_outbound_nat > 0 &&

            hasModeledOutbound
    }

]
.map(
    c => ({

        ...c,

        delta:
            0,


        minDelta:
            c.eligible

                ? -MAX_RATE_DECREASE *
                    c.revenue

                : 0,


        maxDelta:
            c.eligible

                ? Number.POSITIVE_INFINITY

                : 0
    })
);



let residualDelta =
    needsOptimization

        ? totalDelta

        : 0;


let active =
    categories.filter(

        c =>
            c.revenue > 0 &&
            c.eligible
    );



for (

    let pass = 0;

    pass < 10 &&
    Math.abs(residualDelta) > EPSILON &&
    active.length > 0;

    pass++

) {

    const weightTotal =
        active.reduce(

            (
                sum,
                c
            ) =>

                sum +

                Math.pow(
                    c.revenue,
                    IMPACT_POWER
                ),

            0
        );


    if (
        weightTotal <= 0
    ) {

        break;
    }


    let appliedThisPass =
        0;


    const nextActive =
        [];


    for (
        const c
        of active
    ) {

        const weight =
            Math.pow(
                c.revenue,
                IMPACT_POWER
            ) /
            weightTotal;


        const desired =
            residualDelta *
            weight;


        const remainingMinRoom =
            c.minDelta -
            c.delta;


        const remainingMaxRoom =
            c.maxDelta -
            c.delta;


        const applied =
            clamp(

                desired,

                remainingMinRoom,

                remainingMaxRoom
            );


        c.delta +=
            applied;


        appliedThisPass +=
            applied;


        const stillHasRoom =
            residualDelta > 0

                ? c.delta <
                    c.maxDelta -
                    EPSILON

                : c.delta >
                    c.minDelta +
                    EPSILON;


        if (
            stillHasRoom
        ) {

            nextActive.push(
                c
            );
        }
    }


    residualDelta -=
        appliedThisPass;


    if (
        Math.abs(
            appliedThisPass
        ) <= EPSILON
    ) {

        break;
    }


    active =
        nextActive;
}



// ================================================================
// CATEGORY FACTORS
// ================================================================

const cat =
    Object.fromEntries(

        categories.map(

            c => [
                c.key,
                c
            ]
        )
    );


const inboundFactor =
    cat.inbound.revenue > 0

        ? (
            cat.inbound.revenue +
            cat.inbound.delta
        ) /
        cat.inbound.revenue

        : 1;


const storageFactor =
    cat.storage.revenue > 0

        ? (
            cat.storage.revenue +
            cat.storage.delta
        ) /
        cat.storage.revenue

        : 1;


const outboundFactor =
    cat.outbound.revenue > 0

        ? (
            cat.outbound.revenue +
            cat.outbound.delta
        ) /
        cat.outbound.revenue

        : 1;



// ================================================================
// STEP 6: APPLY FACTORS TO RATES
//
// THEN ROUND THE ACTUAL BILLABLE RATE TO $0.01
// ================================================================

// ------------------------------------------------
// PALLETIZED INBOUND
// ------------------------------------------------

const rInPalletNew =
    round2(

        rInPalletOrig *

        inboundFactor
    );



// ------------------------------------------------
// FLOOR-LOADED CARTON RATE
//
// If the container minimum is operative,
// preserve the base carton rate.
//
// The minimum is the component being optimized.
// ------------------------------------------------

const rInCartonScaled =
    round2(

        rInCartonOrig *

        inboundFactor
    );


const rInCartonNew =
    isContainerFloorApplied

        ? round2(
            rInCartonOrig
        )

        : rInCartonScaled;


// ------------------------------------------------
// CONTAINER MINIMUM
// ------------------------------------------------

const rInContainerMinNew =
    round2(

        rInContainerMinOrig *

        inboundFactor
    );



// ------------------------------------------------
// STORAGE
// ------------------------------------------------

const rStorageNew =
    round2(

        rStorageOrig *

        storageFactor
    );



// ------------------------------------------------
// DTC
// ------------------------------------------------

const optimizedDtc = {

    ...dtcData,

    b2c_order_fee:
        round2(

            dtcOrderFeeOrig *

            outboundFactor
        ),


    b2c_unit_pick:
        round2(

            dtcPickFeeOrig *

            outboundFactor
        )
};



// ------------------------------------------------
// B2B
// ------------------------------------------------

const optimizedB2b = {

    ...b2bData,

    b2b_order_fee:
        round2(

            b2bOrderFeeOrig *

            outboundFactor
        ),


    b2b_carton_pick_fee:
        round2(

            b2bCartonFeeOrig *

            outboundFactor
        )
};



// ------------------------------------------------
// PALLET OUT
// ------------------------------------------------

const optimizedPalletOut = {

    ...palletData,

    b2b_pallet_out:
        round2(

            palletOutFeeOrig *

            outboundFactor
        ),


    bol_fee:
        round2(

            bolFeeOrig *

            outboundFactor
        )
};



// ================================================================
// STEP 7: RECALCULATE REVENUE FROM ACTUAL ROUNDED RATES
//
// THIS IS THE IMPORTANT CORRECTION.
//
// Revenue is no longer:
//     old revenue × unrounded factor
//
// It is now:
//     actual rounded rate × actual volume
//
// Therefore N3, N4, N5, and the customer calculator
// can all arrive at the same answer.
// ================================================================


// ================================================================
// INBOUND — PALLETIZED
// ================================================================

const roundedPalletRevenue = (

    hasPallet &&

    palletInboundVol > 0 &&

    palletQtyPerInbound > 0
)

    ? round2(

        palletInboundVol *

        palletQtyPerInbound *

        rInPalletNew
    )

    : 0;



// ================================================================
// INBOUND — FLOOR-LOADED
// ================================================================

const roundedContainerCartonCharge =
    round2(

        containerQtyPerInbound *

        rInCartonNew
    );


const roundedContainerChargePerInbound =
    Math.max(

        roundedContainerCartonCharge,

        rInContainerMinNew
    );


const roundedContainerRevenue = (

    hasContainer &&

    containerInboundVol > 0 &&

    containerQtyPerInbound > 0
)

    ? round2(

        containerInboundVol *

        roundedContainerChargePerInbound
    )

    : 0;



const recalculatedInboundRevenue =
    round2(

        roundedPalletRevenue +

        roundedContainerRevenue
    );


// Safety fallback for older records where the
// operational detail isn't available yet.

const finalInboundRevenue =
    recalculatedInboundRevenue > 0

        ? recalculatedInboundRevenue

        : round2(

            R_inbound_nat *

            inboundFactor
        );



// ================================================================
// STORAGE
// ================================================================

const finalStorageRevenue =
    round2(

        isSqftStorage

            ? storageQtyRaw *
                rStorageNew

            : totalPEQ *
                rStorageNew
    );



// ================================================================
// OUTBOUND — DTC
// ================================================================

const finalDtcRevenue =
    round2(

        dtcVol *

        (
            optimizedDtc.b2c_order_fee +

            (
                dtcUnitsPerOrder *

                optimizedDtc.b2c_unit_pick
            )
        )
    );



// ================================================================
// OUTBOUND — B2B
// ================================================================

const finalB2bRevenue =
    round2(

        b2bVol *

        (
            optimizedB2b.b2b_order_fee +

            (
                b2bCasesPerOrder *

                optimizedB2b.b2b_carton_pick_fee
            )
        )
    );



// ================================================================
// OUTBOUND — PALLET OUT
// ================================================================

const finalPalletRevenue =
    round2(

        palletVol *

        (
            (
                palletsPerOrder *

                optimizedPalletOut.b2b_pallet_out
            ) +

            optimizedPalletOut.bol_fee
        )
    );



// ================================================================
// TOTAL OUTBOUND
// ================================================================

const finalOutboundRevenue =
    round2(

        finalDtcRevenue +

        finalB2bRevenue +

        finalPalletRevenue
    );



// ================================================================
// STEP 8: FINAL REVENUE / RPP
// ================================================================

// ------------------------------------------------
// RPP REVENUE
//
// ONLY:
//
// Inbound
// + Storage
// + Outbound
// ------------------------------------------------

const finalVariableRevenue =
    round2(

        finalInboundRevenue +

        finalStorageRevenue +

        finalOutboundRevenue
    );



// ------------------------------------------------
// TOTAL ACCOUNT BILLING REVENUE
//
// Includes monthly cart/admin revenue,
// but this does NOT affect RPP.
// ------------------------------------------------

const finalBillingRevenue =
    round2(

        finalVariableRevenue +

        adminRevenueExcludedFromRpp
    );



// ------------------------------------------------
// FINAL RPP
// ------------------------------------------------

const finalRPP =
    totalPEQ > 0

        ? round2(

            finalVariableRevenue /

            totalPEQ
        )

        : 0;



// ------------------------------------------------
// ROUNDING DIAGNOSTICS
//
// Because billable rates must be rounded to cents,
// there can be a very small difference from the
// mathematical target.
// ------------------------------------------------

const roundingResidualToTarget =
    round2(

        R_target -

        finalVariableRevenue
    );


const rppVarianceToTarget =
    round2(

        finalRPP -

        targetRPP
    );


const targetAchieved =
    Math.abs(
        rppVarianceToTarget
    ) <= 0.01;



// ================================================================
// BACKWARDS-COMPATIBLE EFFECTIVE MULTIPLIER
// ================================================================

const M =
    R_variable_nat > 0

        ? finalVariableRevenue /

            R_variable_nat

        : 1;



// ================================================================
// STEP 9: RATE CARD OUTPUTS
// ================================================================

const newRates = {

    // ------------------------------------------------
    // INBOUND
    // ------------------------------------------------

    inbound_pallet_original:
        round2(
            rInPalletOrig
        ),


    inbound_pallet_new:
        rInPalletNew,


    Master_Carton_In_original:
        round2(
            rInCartonOrig
        ),


    Master_Carton_In_new:
        rInCartonNew,


    inbound_container_min_original:
        round2(
            rInContainerMinOrig
        ),


    inbound_container_min_new:
        rInContainerMinNew,


    // ------------------------------------------------
    // DTC
    // ------------------------------------------------

    b2c_order_fee_original:
        round2(
            dtcOrderFeeOrig
        ),


    b2c_order_fee_new:
        optimizedDtc
            .b2c_order_fee,


    b2c_unit_pick_original:
        round2(
            dtcPickFeeOrig
        ),


    b2c_unit_pick_new:
        optimizedDtc
            .b2c_unit_pick,


    // ------------------------------------------------
    // B2B
    // ------------------------------------------------

    b2b_order_fee_original:
        round2(
            b2bOrderFeeOrig
        ),


    b2b_order_fee_new:
        optimizedB2b
            .b2b_order_fee,


    b2b_carton_pick_fee_original:
        round2(
            b2bCartonFeeOrig
        ),


    b2b_carton_pick_fee_new:
        optimizedB2b
            .b2b_carton_pick_fee,


    // ------------------------------------------------
    // PALLET OUT
    // ------------------------------------------------

    b2b_pallet_out_original:
        round2(
            palletOutFeeOrig
        ),


    b2b_pallet_out_new:
        optimizedPalletOut
            .b2b_pallet_out,


    bol_fee_original:
        round2(
            bolFeeOrig
        ),


    bol_fee_new:
        optimizedPalletOut
            .bol_fee
};



// ================================================================
// STORAGE RATE OUTPUTS
// ================================================================

if (
    isSqftStorage
) {

    newRates.SQFT_rate_original =
        round2(
            rStorageOrig
        );


    newRates.SQFT_rate_new =
        rStorageNew;
}

else {

    newRates.storage_pallet_base_original =
        round2(
            rStorageOrig
        );


    newRates.storage_pallet_base_new =
        rStorageNew;


    newRates.storage_pallet_longterm_original =
        round2(

            num(
                s3.storage_pallet_longterm,

                rStorageOrig *
                1.5
            )
        );


    newRates.storage_pallet_longterm_new =
        round2(

            rStorageNew *

            1.5
        );
}



// ================================================================
// MONTHLY MINIMUM
// ================================================================

const updatedMiscSection = {

    ...s5,

    monthly_minimum:
        dynamicTargetFloor
};



// ================================================================
// FINAL OUTPUT
// ================================================================

return [{

    json: {


        // ========================================================
        // STATIC
        // ========================================================

        section_1_static: {

            ...s1,

            Lead_rpp:
                leadRPP,

            Warehouse_rpp:
                targetRPP,

            Final_rpp:
                finalRPP
        },



        // ========================================================
        // INBOUND
        // ========================================================

        section_2_inbound: {

            ...s2,


            // ----------------------------------------------------
            // Preserve individual inbound operational quantities
            // for N4 / N5.
            // ----------------------------------------------------

            pallet_avg_inbound_qty_per_month:
                palletInboundVol,


            pallet_avg_qty_per_inbound:
                palletQtyPerInbound,


            container_avg_inbound_qty_per_month:
                containerInboundVol,


            container_avg_qty_per_inbound:
                containerQtyPerInbound,


            // ----------------------------------------------------
            // FINAL RATES
            // ----------------------------------------------------

            inbound_pallet:
                rInPalletNew,


            Master_Carton_In:
                rInCartonNew,


            inbound_container_min:
                rInContainerMinNew,


            r_in_pallet_new:
                rInPalletNew,


            r_in_container_new:
                rInCartonNew,


            inbound_container_min_new:
                rInContainerMinNew,


            // ----------------------------------------------------
            // REVENUE
            // ----------------------------------------------------

            inbound_revenue_original:
                round2(
                    R_inbound_nat
                ),


            inbound_revenue_new:
                finalInboundRevenue,


            inbound_revenue:
                finalInboundRevenue,


            inbound_pallet_revenue_new:
                roundedPalletRevenue,


            inbound_container_revenue_new:
                roundedContainerRevenue,


            is_container_floor_applied:
                isContainerFloorApplied
        },



        // ========================================================
        // STORAGE
        // ========================================================

        section_3_storage: {

            ...s3,


            storage_pallet_base:
                rStorageNew,


            r_st_original:
                round2(
                    rStorageOrig
                ),


            r_st_new:
                rStorageNew,


            storage_revenue_original:
                round2(
                    R_storage_nat
                ),


            storage_revenue_new:
                finalStorageRevenue,


            storage_revenue:
                finalStorageRevenue,


            storage_pallet_longterm:
                isSqftStorage

                    ? s3.storage_pallet_longterm

                    : round2(

                        rStorageNew *

                        1.5
                    ),


            storage_pallet_longterm_new:
                isSqftStorage

                    ? s3.storage_pallet_longterm_new

                    : round2(

                        rStorageNew *

                        1.5
                    ),


            ...(
                isSqftStorage

                    ? {
                        SQFT_rate:
                            rStorageNew
                    }

                    : {}
            )
        },



        // ========================================================
        // OUTBOUND
        // ========================================================

        section_4_outbound: {

            ...s4,


            DTC:
                Object.keys(
                    dtcData
                ).length

                    ? optimizedDtc

                    : s4.DTC,


            B2B:
                Object.keys(
                    b2bData
                ).length

                    ? optimizedB2b

                    : s4.B2B,


            PalletOut:
                Object.keys(
                    palletData
                ).length

                    ? optimizedPalletOut

                    : s4.PalletOut,


            outbound_revenue_original:
                round2(
                    R_outbound_nat
                ),


            outbound_revenue_anchored:
                round2(
                    R_outbound_nat
                ),


            outbound_revenue_new:
                finalOutboundRevenue,


            outbound_revenue:
                finalOutboundRevenue,


            // ----------------------------------------------------
            // INDIVIDUAL PROFILE REVENUE
            // ----------------------------------------------------

            dtc_revenue_new:
                finalDtcRevenue,


            b2b_revenue_new:
                finalB2bRevenue,


            pallet_out_revenue_new:
                finalPalletRevenue
        },



        // ========================================================
        // MISC
        // ========================================================

        section_5_misc:
            updatedMiscSection,



        // ========================================================
        // OPTIMIZATION DIAGNOSTICS
        // ========================================================

        yield_optimization: {


            needs_optimization:
                needsOptimization,


            direction,


            // ----------------------------------------------------
            // NATURAL RPP REVENUE
            //
            // Excludes admin.
            // ----------------------------------------------------

            R_nat:
                round2(
                    R_nat
                ),


            R_nat_with_admin:
                round2(
                    R_nat_with_admin
                ),


            // ----------------------------------------------------
            // TARGET
            // ----------------------------------------------------

            R_target:
                round2(
                    R_target
                ),


            // Monthly billing protection only.
            dynamic_floor:
                dynamicTargetFloor,


            revenue_delta_requested:
                round2(
                    totalDelta
                ),


            residual_unallocated:
                round2(
                    residualDelta
                ),


            // ----------------------------------------------------
            // EFFECTIVE MULTIPLIER
            // ----------------------------------------------------

            multiplier_M:
                Number(
                    M.toFixed(4)
                ),


            // ----------------------------------------------------
            // CATEGORY MULTIPLIERS
            // ----------------------------------------------------

            category_multipliers: {

                inbound:
                    Number(
                        inboundFactor
                            .toFixed(4)
                    ),


                storage:
                    Number(
                        storageFactor
                            .toFixed(4)
                    ),


                outbound:
                    Number(
                        outboundFactor
                            .toFixed(4)
                    )
            },


            // ----------------------------------------------------
            // ORIGINAL CATEGORY WEIGHTS
            // ----------------------------------------------------

            category_weights: {

                inbound:
                    R_variable_nat > 0

                        ? Number(

                            (
                                R_inbound_nat /

                                R_variable_nat
                            )
                            .toFixed(4)
                        )

                        : 0,


                storage:
                    R_variable_nat > 0

                        ? Number(

                            (
                                R_storage_nat /

                                R_variable_nat
                            )
                            .toFixed(4)
                        )

                        : 0,


                outbound:
                    R_variable_nat > 0

                        ? Number(

                            (
                                R_outbound_nat /

                                R_variable_nat
                            )
                            .toFixed(4)
                        )

                        : 0
            },


            // ----------------------------------------------------
            // ORIGINAL CATEGORY REVENUE
            // ----------------------------------------------------

            category_revenue_original: {

                inbound:
                    round2(
                        R_inbound_nat
                    ),


                storage:
                    round2(
                        R_storage_nat
                    ),


                outbound:
                    round2(
                        R_outbound_nat
                    )
            },


            // ----------------------------------------------------
            // FINAL CATEGORY REVENUE
            //
            // ACTUAL ROUNDED RATE × ACTUAL VOLUME
            // ----------------------------------------------------

            category_revenue_final: {

                inbound:
                    finalInboundRevenue,


                storage:
                    finalStorageRevenue,


                outbound:
                    finalOutboundRevenue
            },


            // ----------------------------------------------------
            // RATE CARD RECONCILIATION DETAIL
            // ----------------------------------------------------

            rounded_rate_revenue_detail: {

                inbound_pallet:
                    roundedPalletRevenue,


                inbound_container:
                    roundedContainerRevenue,


                dtc:
                    finalDtcRevenue,


                b2b:
                    finalB2bRevenue,


                pallet_out:
                    finalPalletRevenue
            },


            // ----------------------------------------------------
            // GUARDRAILS
            // ----------------------------------------------------

            max_rate_decrease_pct:
                MAX_RATE_DECREASE,


            max_rate_increase_pct:
                null,


            impact_power:
                IMPACT_POWER,


            // ----------------------------------------------------
            // FINAL RPP ECONOMICS
            // ----------------------------------------------------

            final_revenue:
                finalVariableRevenue,


            final_billing_revenue:
                finalBillingRevenue,


            admin_revenue_excluded_from_rpp:
                round2(
                    adminRevenueExcludedFromRpp
                ),


            final_rpp:
                finalRPP,


            // ----------------------------------------------------
            // ROUNDING DIFFERENCE
            // ----------------------------------------------------

            rounding_residual_to_target:
                roundingResidualToTarget,


            rpp_variance_to_target:
                rppVarianceToTarget,


            target_achieved:
                targetAchieved,


            validated:
                true
        },



        // ========================================================
        // RATE CARD
        // ========================================================

        new_rate_card:
            newRates,



        // ========================================================
        // REVENUE OUTPUTS
        // ========================================================

        // Actual total account billing revenue:
        // RPP revenue + monthly cart/admin fee.

        total_monthly_revenue:
            finalBillingRevenue,


        // Revenue specifically used to calculate RPP.

        rpp_revenue:
            finalVariableRevenue,



        quote_summary:
            input.quote_summary ||
            "No breakdown available.",


        missing_fields:
            [
                ...new Set(
                    missing
                )
            ].length > 0

                ? [
                    ...new Set(
                        missing
                    )
                ]

                : null
    }
}];
 })();
 if(!Array.isArray(result)||!result[0]?.json)throw Error("Production engine returned no quote");
 return result[0].json;
}
