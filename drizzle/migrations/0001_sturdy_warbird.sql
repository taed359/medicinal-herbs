CREATE TABLE "product_certifications" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"cert_type" text NOT NULL,
	"issuing_body" text,
	"certificate_number" text,
	"valid_from" date,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "product_warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"locale" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "product_warnings_locale_check" CHECK ("product_warnings"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
ALTER TABLE "product_benefits" ADD COLUMN "claim_type" text DEFAULT 'marketing' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "net_quantity_value" numeric;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "net_quantity_unit" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "container_type" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "gtin" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "botanical_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "country_of_origin_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "extraction_method" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "manufacturer_name" text;--> statement-breakpoint
ALTER TABLE "product_certifications" ADD CONSTRAINT "product_certifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_warnings" ADD CONSTRAINT "product_warnings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_certifications_product" ON "product_certifications" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_warnings_product" ON "product_warnings" USING btree ("product_id","locale","sort_order");--> statement-breakpoint
ALTER TABLE "product_benefits" ADD CONSTRAINT "product_benefits_claim_type_check" CHECK ("product_benefits"."claim_type" IN ('factual', 'marketing', 'structure_function'));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_net_quantity_unit_check" CHECK ("product_variants"."net_quantity_unit" IN ('ml', 'l', 'g', 'fl_oz'));