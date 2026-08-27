CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"parent_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"category_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale"),
	CONSTRAINT "locale_check" CHECK ("category_translations"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" text PRIMARY KEY NOT NULL,
	"quantity" integer,
	"low_stock_threshold" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"price_minor" bigint NOT NULL,
	"compare_at_minor" bigint,
	"currency" text DEFAULT 'VND' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_benefits" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"locale" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "locale_check" CHECK ("product_benefits"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
CREATE TABLE "product_image_translations" (
	"image_id" text NOT NULL,
	"locale" text NOT NULL,
	"alt" text NOT NULL,
	CONSTRAINT "product_image_translations_image_id_locale_pk" PRIMARY KEY("image_id","locale"),
	CONSTRAINT "locale_check" CHECK ("product_image_translations"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"role" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_role_check" CHECK ("product_images"."role" IN ('primary', 'gallery', 'thumbnail'))
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"product_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"ingredients" text,
	"usage_instructions" text,
	CONSTRAINT "product_translations_product_id_locale_pk" PRIMARY KEY("product_id","locale"),
	CONSTRAINT "locale_check" CHECK ("product_translations"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
CREATE TABLE "product_variant_translations" (
	"variant_id" text NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "product_variant_translations_variant_id_locale_pk" PRIMARY KEY("variant_id","locale"),
	CONSTRAINT "locale_check" CHECK ("product_variant_translations"."locale" IN ('vi', 'zh'))
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"category_id" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing" ADD CONSTRAINT "pricing_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_benefits" ADD CONSTRAINT "product_benefits_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image_translations" ADD CONSTRAINT "product_image_translations_image_id_product_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_translations" ADD CONSTRAINT "product_variant_translations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_variant_active" ON "pricing" USING btree ("variant_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_product_benefits_product" ON "product_benefits" USING btree ("product_id","locale","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_images_one_primary" ON "product_images" USING btree ("product_id") WHERE "product_images"."role" = 'primary';--> statement-breakpoint
CREATE INDEX "idx_product_images_product" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_variants_one_default" ON "product_variants" USING btree ("product_id") WHERE "product_variants"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_featured" ON "products" USING btree ("is_featured") WHERE "products"."is_featured" = true;--> statement-breakpoint
CREATE INDEX "idx_products_published" ON "products" USING btree ("is_published") WHERE "products"."is_published" = true;