/*
 * "WELLMIX PROCEDURES": o texto padrão que acompanha todo pedido de compra
 * (página própria do documento do pedido, docs/ORDER_SIGNATURE.md). É o
 * texto do modelo de pedido da Wellmix, em inglês, como vai ao fornecedor.
 */

export interface ProcedureSection {
  title: string;
  lines: string[];
}

export const ORDER_PROCEDURES_TITLE = "WELLMIX PROCEDURES";

export const ORDER_PROCEDURES: ProcedureSection[] = [
  {
    title: "Quotation, Reorders and New Product Orders",
    lines: [
      "Upon receiving this request, please send us an overnight reply.",
      "For QUOTATION requests: please fill in your price on column “Price”. For more details, please use column “Comments”.",
      "For REORDERS: production must be finished within 30 to 40 days after receiving this request.",
      "For NEW PRODUCT ORDERS: upon receiving our signed PO and artworks, delivery time is 30 to 50 days.",
      "Please make sure to check and confirm your prices before signing the PO. After this agreement, we won't accept any price increase.",
      "In case of any difficulties in contacting the factory/supplier, please reach out to them directly or/and in person.",
      "Before starting mass production of NEW PRODUCTS, we must receive pictures of the goods for approval.",
      "Always use our order NO., process NO. and item NO. for email communication.",
    ],
  },
  {
    title: "Shipping status:",
    lines: [
      "Please follow-up closely with supplier/factory to ensure that the goods will be finished on time.",
      "Confirmation of shipping dates for all items under production is MANDATORY",
      "Inspection report must be submitted to our approval, in our report standard form and before loading the goods.",
      "Do not modify details such as product weight, dimensions and CBM of products with certification requirements.",
    ],
  },
  {
    title: "Marketing:",
    lines: [
      "Professional pictures of all products are MANDATORY. For every picture, we should receive both PSD and JPG files.",
    ],
  },
  {
    title: "New Items:",
    lines: [
      "Please send us detailed description of all items, such as raw material, colors, functionality and more.",
      "The time to collect die cut and original package in one order should not be over 2 weeks.",
      "Upon receiving our artworks, supplier has 48 hours to check and confirm if they are ok. In case of no response in 2 days, we will consider production time launched and counting.",
    ],
  },
  {
    title: "Shipments:",
    lines: [
      "Always ship two or more containers on the same BL, unless the request is to anticipate an order ASAP.",
      "All orders will be placed with full containers, so the PO must be shipped in full as well.",
      "Packing list and invoice must be sent to us on the second working day after loading.",
    ],
  },
];
