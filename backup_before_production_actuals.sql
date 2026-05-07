--
-- PostgreSQL database dump
--

\restrict hkKWRkiWZRhnf4poaSazFihmjlIa5rIsMVTMgCHm1iMjzaFoJ56BtEMFOPq7cJa

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: validate_production_plan_line_nomenclature(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_production_plan_line_nomenclature() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_item_type TEXT;
    v_unit_of_measure TEXT;
BEGIN
    SELECT
        item_type,
        unit_of_measure
    INTO
        v_item_type,
        v_unit_of_measure
    FROM nomenclature
    WHERE nomenclature_id = NEW.nomenclature_id;

    IF v_item_type IS NULL THEN
        RAISE EXCEPTION 'Номенклатура не найдена.';
    END IF;

    IF v_item_type <> 'manufactured' THEN
        RAISE EXCEPTION 'В план выпуска можно добавить только производимую номенклатуру.';
    END IF;

    NEW.unit_of_measure := v_unit_of_measure;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_production_plan_line_nomenclature() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: inventory_balance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_balance (
    balance_id bigint NOT NULL,
    as_of_date date NOT NULL,
    nomenclature_id bigint NOT NULL,
    available_qty numeric(14,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_balance_available_qty_check CHECK ((available_qty >= (0)::numeric))
);


ALTER TABLE public.inventory_balance OWNER TO postgres;

--
-- Name: inventory_balance_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_balance ALTER COLUMN balance_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.inventory_balance_balance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machines (
    machine_id bigint NOT NULL,
    machine_code character varying NOT NULL,
    machine_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.machines OWNER TO postgres;

--
-- Name: machines_machine_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.machines ALTER COLUMN machine_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.machines_machine_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nomenclature; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nomenclature (
    nomenclature_id bigint NOT NULL,
    nomenclature_code character varying NOT NULL,
    nomenclature_name text NOT NULL,
    unit_of_measure text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    item_type text DEFAULT 'manufactured'::text NOT NULL,
    CONSTRAINT nomenclature_item_type_check CHECK ((item_type = ANY (ARRAY['manufactured'::text, 'purchased'::text]))),
    CONSTRAINT nomenclature_unit_of_measure_check CHECK ((unit_of_measure = ANY (ARRAY['м²'::text, 'м.п.'::text, 'шт'::text, 'кг'::text, 'л'::text])))
);


ALTER TABLE public.nomenclature OWNER TO postgres;

--
-- Name: nomenclature_nomenclature_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.nomenclature ALTER COLUMN nomenclature_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.nomenclature_nomenclature_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: processes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processes (
    process_id bigint NOT NULL,
    process_code character varying NOT NULL,
    process_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.processes OWNER TO postgres;

--
-- Name: processes_process_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.processes ALTER COLUMN process_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.processes_process_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: production_plan_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_plan_lines (
    production_plan_line_id bigint NOT NULL,
    production_plan_id bigint NOT NULL,
    nomenclature_id bigint NOT NULL,
    planned_qty numeric(12,3) NOT NULL,
    unit_of_measure text NOT NULL,
    is_priority boolean DEFAULT false NOT NULL,
    priority_note text,
    line_comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_plan_lines_planned_qty_check CHECK ((planned_qty > (0)::numeric)),
    CONSTRAINT production_plan_lines_unit_of_measure_check CHECK ((unit_of_measure = ANY (ARRAY['м²'::text, 'м.п.'::text, 'шт'::text, 'кг'::text, 'л'::text])))
);


ALTER TABLE public.production_plan_lines OWNER TO postgres;

--
-- Name: production_plan_lines_production_plan_line_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.production_plan_lines ALTER COLUMN production_plan_line_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.production_plan_lines_production_plan_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: production_plan_weeks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_plan_weeks (
    production_plan_week_id bigint NOT NULL,
    production_plan_id bigint NOT NULL,
    week_no integer NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_plan_weeks_dates_check CHECK ((week_end_date >= week_start_date)),
    CONSTRAINT production_plan_weeks_status_check CHECK ((status = 'draft'::text)),
    CONSTRAINT production_plan_weeks_week_no_check CHECK (((week_no > 0) AND (week_no <= 6)))
);


ALTER TABLE public.production_plan_weeks OWNER TO postgres;

--
-- Name: production_plan_weeks_production_plan_week_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.production_plan_weeks ALTER COLUMN production_plan_week_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.production_plan_weeks_production_plan_week_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: production_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_plans (
    production_plan_id bigint NOT NULL,
    plan_month date NOT NULL,
    source_balance_date date,
    source_calculated_at timestamp with time zone,
    plan_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_plans_plan_month_first_day_check CHECK ((plan_month = (date_trunc('month'::text, (plan_month)::timestamp with time zone))::date)),
    CONSTRAINT production_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text])))
);


ALTER TABLE public.production_plans OWNER TO postgres;

--
-- Name: production_plans_production_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.production_plans ALTER COLUMN production_plan_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.production_plans_production_plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: production_week_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_week_lines (
    production_week_line_id bigint NOT NULL,
    production_plan_week_id bigint NOT NULL,
    production_plan_line_id bigint NOT NULL,
    route_step_equipment_id bigint,
    planned_qty numeric(12,3) NOT NULL,
    batch_count integer DEFAULT 1 NOT NULL,
    sequence_no integer DEFAULT 1 NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_week_lines_batch_count_check CHECK ((batch_count > 0)),
    CONSTRAINT production_week_lines_planned_qty_check CHECK ((planned_qty > (0)::numeric)),
    CONSTRAINT production_week_lines_sequence_no_check CHECK ((sequence_no > 0))
);


ALTER TABLE public.production_week_lines OWNER TO postgres;

--
-- Name: production_week_lines_production_week_line_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.production_week_lines ALTER COLUMN production_week_line_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.production_week_lines_production_week_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: route_step_equipment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_step_equipment (
    step_equipment_id bigint NOT NULL,
    route_step_id bigint NOT NULL,
    machine_id bigint NOT NULL,
    equipment_role text NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    nominal_rate numeric(12,3) NOT NULL,
    rate_uom text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_batch_qty numeric(12,3),
    CONSTRAINT route_step_equipment_equipment_role_check CHECK ((equipment_role = ANY (ARRAY['primary'::text, 'alternative'::text]))),
    CONSTRAINT route_step_equipment_min_batch_qty_check CHECK (((min_batch_qty IS NULL) OR (min_batch_qty > (0)::numeric))),
    CONSTRAINT route_step_equipment_nominal_rate_check CHECK ((nominal_rate > (0)::numeric)),
    CONSTRAINT route_step_equipment_priority_check CHECK ((priority > 0)),
    CONSTRAINT route_step_equipment_rate_uom_check CHECK ((rate_uom = ANY (ARRAY['м²/мин'::text, 'м.п./мин'::text])))
);


ALTER TABLE public.route_step_equipment OWNER TO postgres;

--
-- Name: route_step_equipment_step_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.route_step_equipment ALTER COLUMN step_equipment_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.route_step_equipment_step_equipment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: route_step_inputs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_step_inputs (
    step_input_id bigint NOT NULL,
    route_step_id bigint NOT NULL,
    input_nomenclature_id bigint,
    external_input_name text,
    input_qty numeric(12,3) DEFAULT 1.000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT route_step_inputs_check CHECK (((input_nomenclature_id IS NOT NULL) OR (external_input_name IS NOT NULL))),
    CONSTRAINT route_step_inputs_input_qty_check CHECK ((input_qty > (0)::numeric))
);


ALTER TABLE public.route_step_inputs OWNER TO postgres;

--
-- Name: route_step_inputs_step_input_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.route_step_inputs ALTER COLUMN step_input_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.route_step_inputs_step_input_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: route_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_steps (
    route_step_id bigint NOT NULL,
    route_id bigint NOT NULL,
    step_no integer NOT NULL,
    process_id bigint NOT NULL,
    output_nomenclature_id bigint NOT NULL,
    output_qty numeric(12,3) DEFAULT 1.000 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    post_process_wait_hours numeric(8,2),
    CONSTRAINT route_steps_output_qty_check CHECK ((output_qty > (0)::numeric)),
    CONSTRAINT route_steps_post_process_wait_hours_check CHECK (((post_process_wait_hours IS NULL) OR (post_process_wait_hours >= (0)::numeric))),
    CONSTRAINT route_steps_step_no_check CHECK ((step_no > 0))
);


ALTER TABLE public.route_steps OWNER TO postgres;

--
-- Name: route_steps_route_step_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.route_steps ALTER COLUMN route_step_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.route_steps_route_step_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    route_id bigint NOT NULL,
    route_code character varying NOT NULL,
    route_name text NOT NULL,
    result_nomenclature_id bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- Name: routes_route_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.routes ALTER COLUMN route_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.routes_route_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: safety_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_stock (
    safety_stock_id bigint NOT NULL,
    nomenclature_id bigint NOT NULL,
    stock_qty numeric(14,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT safety_stock_stock_qty_check CHECK ((stock_qty >= (0)::numeric))
);


ALTER TABLE public.safety_stock OWNER TO postgres;

--
-- Name: safety_stock_safety_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_stock ALTER COLUMN safety_stock_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.safety_stock_safety_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales_plan; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_plan (
    sales_plan_id bigint NOT NULL,
    plan_date date NOT NULL,
    nomenclature_id bigint NOT NULL,
    plan_qty numeric(14,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_plan_plan_qty_check CHECK ((plan_qty >= (0)::numeric))
);


ALTER TABLE public.sales_plan OWNER TO postgres;

--
-- Name: sales_plan_sales_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.sales_plan ALTER COLUMN sales_plan_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sales_plan_sales_plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: inventory_balance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_balance (balance_id, as_of_date, nomenclature_id, available_qty, created_at, updated_at) FROM stdin;
1	2026-04-25	4	30.000	2026-04-25 02:51:55.163808+00	2026-04-25 02:51:55.163808+00
2	2026-04-25	16	30.000	2026-04-25 02:56:10.235135+00	2026-04-25 02:56:10.235135+00
4	2026-05-01	1	2500.000	2026-04-27 15:07:42.886282+00	2026-04-27 15:07:42.886282+00
5	2026-05-01	4	500.000	2026-04-28 15:38:32.829628+00	2026-04-28 15:38:32.829628+00
6	2026-05-01	19	100.000	2026-04-29 09:22:55.384402+00	2026-04-29 09:22:55.384402+00
7	2026-05-01	20	2000.000	2026-05-07 05:44:55.895763+00	2026-05-07 05:47:46.651715+00
8	2026-05-01	23	1000.000	2026-05-07 05:59:52.399035+00	2026-05-07 05:59:52.399035+00
10	2026-05-01	28	100000.000	2026-05-07 06:23:00.055235+00	2026-05-07 06:26:44.491747+00
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machines (machine_id, machine_code, machine_name, is_active, created_at, updated_at) FROM stdin;
1	MC-001	Линия подготовки полотна	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
5	MC-005	Линия окраски профиля	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
6	MC-006	Линия продольной резки профиля	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
4	MC-004	Резательный комплекс полотна	t	2026-04-20 07:23:46.726594+00	2026-04-24 11:04:14.96288+00
2	MC-002	Ламинатор LAM-1600	t	2026-04-20 07:23:46.726594+00	2026-04-24 11:26:23.230121+00
7	MC-007	Экструдер 2	t	2026-04-22 15:38:07.933598+00	2026-04-29 05:08:44.692865+00
3	MC-003	Ламинатор  1	t	2026-04-20 07:23:46.726594+00	2026-04-29 05:09:23.444291+00
8	MC-008	Дубликатор	t	2026-04-29 05:09:56.797577+00	2026-04-29 05:09:56.797577+00
9	MC-009	Ламинатор 2	t	2026-04-29 05:10:28.085191+00	2026-04-29 05:10:28.085191+00
10	MC-010	Экструдер 3	t	2026-05-03 04:03:50.410747+00	2026-05-03 04:03:50.410747+00
11	МС-011	Перемотчик 1	t	2026-05-03 04:17:02.474687+00	2026-05-03 04:17:02.474687+00
12	MC-012	Перемотчик 2	t	2026-05-03 04:17:32.594279+00	2026-05-03 04:17:32.594279+00
\.


--
-- Data for Name: nomenclature; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nomenclature (nomenclature_id, nomenclature_code, nomenclature_name, unit_of_measure, is_active, created_at, updated_at, item_type) FROM stdin;
2	NM-002	Полотно грунтованное	м²	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
3	NM-003	Полотно ламинированное белое полуфабрикат	м²	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
5	NM-005	Полотно ламинированное серое	м²	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
7	NM-007	Пленка декоративная серая	м²	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
8	NM-008	Профиль ПВХ базовый	м.п.	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
9	NM-009	Профиль ПВХ окрашенный белый	м.п.	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
10	NM-010	Кромка ПВХ белая 50 мм	м.п.	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
11	NM-011	Декоративная вставка ПВХ	м.п.	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	manufactured
1	NM-001	Полотно-основа универсальное	м²	t	2026-04-20 07:23:46.726594+00	2026-04-21 15:54:37.737826+00	manufactured
6	NM-006	Пленка декоративная белая	м²	t	2026-04-20 07:23:46.726594+00	2026-04-21 16:13:09.648299+00	manufactured
4	NM-004	Полотно ламинированное белое	м²	t	2026-04-20 07:23:46.726594+00	2026-04-22 16:10:01.463469+00	manufactured
12	NM-012	Тест новой позиции номенклатуры	м²	t	2026-04-21 15:53:37.755752+00	2026-04-22 16:10:07.241467+00	manufactured
13	NM-013	Тестирование новой номенклатуры 2	м²	t	2026-04-22 16:10:55.835511+00	2026-04-22 16:10:55.835511+00	manufactured
14	NM-014	Тест  позиция номенклатуры вход 1	м²	t	2026-04-24 02:56:45.978754+00	2026-04-24 02:56:45.978754+00	manufactured
15	NM-015	Тест позиция номенклатура вход 2	м²	t	2026-04-24 02:57:19.259321+00	2026-04-24 02:57:19.259321+00	manufactured
16	NM-016	Тестовая номенклатура 3	м²	t	2026-04-24 07:42:35.905918+00	2026-04-24 07:42:35.905918+00	manufactured
17	NM-017	Полотно ламинированное белое	м²	f	2026-04-24 12:56:25.074519+00	2026-04-24 13:02:55.449425+00	manufactured
25	PU-02	ПВД	кг	t	2026-04-29 08:22:34.506378+00	2026-04-29 08:38:24.252952+00	purchased
26	PU-03	ФПЦ 0001*105*6000	м²	t	2026-04-29 08:40:38.868229+00	2026-04-29 08:40:38.868229+00	purchased
24	PU-01	Фольга 0,017*105*4000	м²	t	2026-04-29 08:20:34.494623+00	2026-04-29 09:09:35.99653+00	purchased
19	NM-020	Полотно ПФК  10*1*4.5	м²	t	2026-04-29 05:04:49.809186+00	2026-04-29 09:14:12.607799+00	manufactured
20	NM-021	Полуфабрикат Изодом 10*105*90	м²	t	2026-04-29 05:12:06.006048+00	2026-04-29 09:15:53.747245+00	manufactured
22	NM-023	Полуфабрикат Изодом ПФ 10*105*90	м²	t	2026-04-29 05:21:01.745394+00	2026-04-29 09:17:33.71489+00	manufactured
23	NM-024	Полуфабрикат Изодом  ПФК 10*105*90	м²	t	2026-04-29 05:28:20.170609+00	2026-04-29 09:18:59.897382+00	manufactured
27	NM-025	Полотно Изодом 3*1*10	м²	t	2026-05-03 03:52:46.279401+00	2026-05-03 03:56:25.53516+00	manufactured
21	PU-04	ПВД 158	кг	t	2026-04-29 05:13:38.154228+00	2026-05-03 04:01:40.385171+00	purchased
28	NM-026	Полуфабрикат Изодом 3*105*205	м²	t	2026-05-03 03:56:01.197776+00	2026-05-03 04:02:03.181697+00	manufactured
\.


--
-- Data for Name: processes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.processes (process_id, process_code, process_name, is_active) FROM stdin;
6	PR-005	Тест технологической операции	t
1	PR-001	Изготовление полуфабриката полотна	t
3	PR-003	Ламинация 2_Наклейка самоклеящегося слоя	t
4	PR-004	Перемотка на дубликаторе	t
2	PR-002	Ламинация 1_Наклейка фольги	t
7	PR-006	Перемотка	t
\.


--
-- Data for Name: production_plan_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_plan_lines (production_plan_line_id, production_plan_id, nomenclature_id, planned_qty, unit_of_measure, is_priority, priority_note, line_comment, created_at, updated_at) FROM stdin;
14	9	19	19900.000	м²	t	\N	Леруа	2026-04-29 14:52:08.363028+00	2026-05-07 06:28:14.216531+00
15	9	20	17895.000	м²	f	\N	\N	2026-04-29 14:52:08.363028+00	2026-05-07 06:28:14.216531+00
16	9	22	19895.000	м²	f	\N	\N	2026-04-29 14:52:08.363028+00	2026-05-07 06:28:14.216531+00
17	9	23	19895.000	м²	f	\N	\N	2026-04-29 14:52:08.363028+00	2026-05-07 06:28:14.216531+00
23	9	27	500000.000	м²	f	\N	\N	2026-05-03 04:30:57.337088+00	2026-05-07 06:28:14.216531+00
24	9	28	425000.000	м²	f	\N	\N	2026-05-03 04:30:57.337088+00	2026-05-07 06:28:14.216531+00
\.


--
-- Data for Name: production_plan_weeks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_plan_weeks (production_plan_week_id, production_plan_id, week_no, week_start_date, week_end_date, status, comment, created_at, updated_at) FROM stdin;
14	9	2	2026-07-08	2026-07-14	draft	\N	2026-05-07 06:01:54.278096+00	2026-05-07 06:01:54.278096+00
16	9	1	2026-07-01	2026-07-07	draft	\N	2026-05-07 06:57:53.515308+00	2026-05-07 06:57:53.515308+00
\.


--
-- Data for Name: production_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_plans (production_plan_id, plan_month, source_balance_date, source_calculated_at, plan_name, status, comment, created_at, updated_at) FROM stdin;
9	2026-07-01	2026-05-01	2026-05-07 06:28:02.349+00	План выпуска на 2026-07	approved	Сформирован из расчёта потребности	2026-04-29 14:52:08.363028+00	2026-05-07 06:28:30.617637+00
\.


--
-- Data for Name: production_week_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_week_lines (production_week_line_id, production_plan_week_id, production_plan_line_id, route_step_equipment_id, planned_qty, batch_count, sequence_no, comment, created_at, updated_at) FROM stdin;
47	16	24	25	200000.000	1	3	\N	2026-05-07 07:01:51.640832+00	2026-05-07 07:26:47.702991+00
48	14	23	23	490000.000	1	1	\N	2026-05-07 07:20:29.05343+00	2026-05-07 07:26:54.455544+00
\.


--
-- Data for Name: route_step_equipment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_step_equipment (step_equipment_id, route_step_id, machine_id, equipment_role, priority, nominal_rate, rate_uom, is_active, created_at, updated_at, min_batch_qty) FROM stdin;
1	1	1	primary	1	18.000	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
2	2	2	primary	1	12.000	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
3	2	3	alternative	2	10.500	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
4	3	4	primary	1	25.000	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
5	4	1	primary	1	18.000	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
6	5	3	primary	1	11.000	м²/мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
7	6	5	primary	1	35.000	м.п./мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
8	7	6	primary	1	42.000	м.п./мин	t	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
15	17	3	primary	1	15.000	м²/мин	t	2026-04-24 11:13:04.005327+00	2026-04-24 11:13:04.005327+00	\N
16	18	7	primary	1	10.000	м²/мин	t	2026-04-24 11:13:30.839223+00	2026-04-24 11:13:30.839223+00	\N
14	13	1	primary	1	25.000	м²/мин	t	2026-04-24 11:12:36.442816+00	2026-04-24 13:15:51.230497+00	\N
17	19	7	primary	1	37.500	м²/мин	t	2026-04-29 05:19:14.270218+00	2026-05-02 17:27:23.882498+00	2.000
18	20	3	primary	1	25.000	м²/мин	t	2026-04-29 05:23:22.930999+00	2026-05-02 17:27:48.388002+00	2.000
19	21	3	primary	1	25.000	м²/мин	t	2026-04-29 05:25:06.986766+00	2026-05-02 17:28:09.6431+00	2.000
20	21	9	alternative	2	25.000	м²/мин	t	2026-04-29 05:25:22.691895+00	2026-05-02 17:28:17.837814+00	2.000
21	22	8	primary	1	5.000	м²/мин	t	2026-04-29 05:30:41.743574+00	2026-05-02 17:28:31.603488+00	2.000
22	23	10	primary	1	58.330	м²/мин	t	2026-05-03 04:05:34.267853+00	2026-05-03 04:05:34.267853+00	84000.000
23	24	11	primary	1	12.780	м²/мин	t	2026-05-03 04:19:00.002842+00	2026-05-03 04:19:00.002842+00	\N
24	24	12	primary	2	12.780	м²/мин	t	2026-05-03 04:19:31.288365+00	2026-05-03 04:19:31.288365+00	\N
25	25	10	primary	1	58330.000	м²/мин	t	2026-05-05 13:51:47.19602+00	2026-05-05 13:51:47.19602+00	\N
\.


--
-- Data for Name: route_step_inputs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_step_inputs (step_input_id, route_step_id, input_nomenclature_id, external_input_name, input_qty, created_at, updated_at) FROM stdin;
3	2	2	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
5	3	3	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
6	4	1	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
8	5	2	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
9	5	7	\N	1.020	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
10	6	8	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
12	7	9	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
13	7	11	\N	1.000	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00
24	17	13	\N	1.000	2026-04-24 07:37:26.937903+00	2026-04-24 07:37:26.937903+00
30	13	15	\N	1.000	2026-04-24 14:59:39.393655+00	2026-04-24 14:59:39.393655+00
25	18	10	\N	1.000	2026-04-24 07:43:50.272315+00	2026-04-25 03:03:44.788734+00
29	13	14	\N	0.850	2026-04-24 14:59:15.263323+00	2026-04-27 00:53:19.527246+00
1	1	1	\N	1.500	2026-04-20 07:23:46.726594+00	2026-04-28 15:08:44.265995+00
4	2	6	\N	2000.000	2026-04-20 07:23:46.726594+00	2026-04-29 01:58:10.552887+00
34	21	22	\N	1.000	2026-04-29 05:24:11.858903+00	2026-04-29 05:24:11.858903+00
37	19	25	\N	0.148	2026-04-29 08:23:26.993894+00	2026-04-29 08:23:26.993894+00
38	20	24	\N	1.000	2026-04-29 08:42:36.266892+00	2026-04-29 08:42:36.266892+00
39	21	26	\N	1.000	2026-04-29 08:43:20.476991+00	2026-04-29 08:43:20.476991+00
40	23	21	\N	0.078	2026-05-03 04:02:58.751584+00	2026-05-03 04:02:58.751584+00
41	24	28	\N	1.050	2026-05-03 04:08:03.632635+00	2026-05-03 04:08:03.632635+00
36	22	23	\N	1.050	2026-04-29 05:30:20.633048+00	2026-05-03 04:25:25.843625+00
32	20	20	\N	1.000	2026-04-29 05:22:04.032474+00	2026-05-03 04:25:44.921617+00
42	25	21	\N	0.078	2026-05-05 13:51:19.036691+00	2026-05-05 13:51:19.036691+00
\.


--
-- Data for Name: route_steps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_steps (route_step_id, route_id, step_no, process_id, output_nomenclature_id, output_qty, notes, created_at, updated_at, post_process_wait_hours) FROM stdin;
2	1	2	2	3	1.000	Ламинация белой декоративной пленкой	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
3	1	3	3	4	1.000	Финишная резка белого полотна	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
4	2	1	1	2	1.000	Подготовка основы под серую ламинацию	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
5	2	2	2	5	1.000	Ламинация серой декоративной пленкой	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
6	3	1	4	9	1.000	Окраска базового профиля в белый цвет	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
7	3	2	3	10	1.000	Резка и сборка кромки ПВХ 50 мм	2026-04-20 07:23:46.726594+00	2026-04-20 07:23:46.726594+00	\N
13	4	1	1	12	1.000	\N	2026-04-24 05:55:33.308171+00	2026-04-24 06:13:55.405825+00	\N
17	4	2	2	13	1.000	\N	2026-04-24 06:37:14.255964+00	2026-04-24 07:07:35.648925+00	\N
18	4	3	3	16	1.000	\N	2026-04-24 07:41:32.432636+00	2026-04-24 07:44:34.077967+00	\N
20	7	2	2	22	1.000	\N	2026-04-29 05:21:37.017424+00	2026-04-29 05:21:37.017424+00	\N
21	7	3	3	23	1.000	\N	2026-04-29 05:23:53.121815+00	2026-04-29 05:28:59.403434+00	\N
22	7	4	4	19	1.000	\N	2026-04-29 05:29:56.52111+00	2026-04-29 05:29:56.52111+00	\N
24	8	3	7	27	1.000	\N	2026-05-03 04:07:10.040739+00	2026-05-03 04:16:09.019343+00	\N
1	1	1	1	2	1.000	Подготовка основы под белую ламинацию	2026-04-20 07:23:46.726594+00	2026-05-05 11:53:57.281584+00	72.00
23	8	1	1	28	1.000	\N	2026-05-03 04:00:36.386424+00	2026-05-05 12:04:32.829762+00	72.00
19	7	1	1	20	1.000	\N	2026-04-29 05:17:07.032182+00	2026-05-05 12:04:59.653211+00	72.00
25	9	1	1	28	1.000	\N	2026-05-05 13:50:21.393683+00	2026-05-05 13:50:53.624008+00	72.00
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.routes (route_id, route_code, route_name, result_nomenclature_id, is_active, created_at, updated_at) FROM stdin;
4	RT-004	Тестирование нового маршрута	16	t	2026-04-22 16:09:30.535767+00	2026-04-27 00:53:26.234941+00
1	RT-001	Маршрут получения полотна ламинированного белого	4	t	2026-04-20 07:23:46.726594+00	2026-05-05 11:54:00.691255+00
8	RT-006	Маршрут Полотно Изодом 3*1*10	27	t	2026-05-03 03:53:33.112859+00	2026-05-05 12:05:06.890808+00
7	RT-005	Маршрут Полотно ПФК  10*1*4.5	19	t	2026-04-29 05:15:52.260569+00	2026-05-05 12:08:48.439742+00
9	RT-007	Маршрут Полуфабрикат Изодом 3*105*205	28	t	2026-05-05 13:49:04.727575+00	2026-05-05 13:51:56.268495+00
3	RT-003	Маршрут получения кромки ПВХ белой 50 мм	10	t	2026-04-20 07:23:46.726594+00	2026-04-29 08:37:43.906573+00
2	RT-002	Маршрут получения полотна ламинированного серого	5	t	2026-04-20 07:23:46.726594+00	2026-04-29 08:37:46.338505+00
\.


--
-- Data for Name: safety_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.safety_stock (safety_stock_id, nomenclature_id, stock_qty, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sales_plan; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_plan (sales_plan_id, plan_date, nomenclature_id, plan_qty, created_at, updated_at) FROM stdin;
1	2026-04-25	4	100.000	2026-04-25 02:51:55.151584+00	2026-04-25 02:51:55.151584+00
2	2026-04-25	16	100.000	2026-04-25 02:56:10.231588+00	2026-04-25 02:56:10.231588+00
60	2026-07-01	27	500000.000	2026-05-03 04:21:18.739616+00	2026-05-03 04:21:18.739616+00
58	2026-07-01	19	20000.000	2026-04-29 05:34:20.445978+00	2026-05-03 04:27:40.562328+00
29	2026-06-01	4	888.000	2026-04-28 05:38:17.968802+00	2026-04-28 10:49:17.287449+00
\.


--
-- Name: inventory_balance_balance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_balance_balance_id_seq', 10, true);


--
-- Name: machines_machine_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machines_machine_id_seq', 12, true);


--
-- Name: nomenclature_nomenclature_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nomenclature_nomenclature_id_seq', 28, true);


--
-- Name: processes_process_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.processes_process_id_seq', 7, true);


--
-- Name: production_plan_lines_production_plan_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_plan_lines_production_plan_line_id_seq', 27, true);


--
-- Name: production_plan_weeks_production_plan_week_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_plan_weeks_production_plan_week_id_seq', 16, true);


--
-- Name: production_plans_production_plan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_plans_production_plan_id_seq', 47, true);


--
-- Name: production_week_lines_production_week_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_week_lines_production_week_line_id_seq', 48, true);


--
-- Name: route_step_equipment_step_equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_step_equipment_step_equipment_id_seq', 25, true);


--
-- Name: route_step_inputs_step_input_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_step_inputs_step_input_id_seq', 42, true);


--
-- Name: route_steps_route_step_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.route_steps_route_step_id_seq', 25, true);


--
-- Name: routes_route_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.routes_route_id_seq', 9, true);


--
-- Name: safety_stock_safety_stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.safety_stock_safety_stock_id_seq', 7, true);


--
-- Name: sales_plan_sales_plan_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_plan_sales_plan_id_seq', 60, true);


--
-- Name: inventory_balance inventory_balance_as_of_date_nomenclature_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_as_of_date_nomenclature_key UNIQUE (as_of_date, nomenclature_id);


--
-- Name: inventory_balance inventory_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_pkey PRIMARY KEY (balance_id);


--
-- Name: machines machines_machine_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_machine_code_key UNIQUE (machine_code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (machine_id);


--
-- Name: nomenclature nomenclature_nomenclature_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nomenclature
    ADD CONSTRAINT nomenclature_nomenclature_code_key UNIQUE (nomenclature_code);


--
-- Name: nomenclature nomenclature_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nomenclature
    ADD CONSTRAINT nomenclature_pkey PRIMARY KEY (nomenclature_id);


--
-- Name: processes processes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processes
    ADD CONSTRAINT processes_pkey PRIMARY KEY (process_id);


--
-- Name: processes processes_process_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processes
    ADD CONSTRAINT processes_process_code_key UNIQUE (process_code);


--
-- Name: production_plan_lines production_plan_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_lines
    ADD CONSTRAINT production_plan_lines_pkey PRIMARY KEY (production_plan_line_id);


--
-- Name: production_plan_lines production_plan_lines_unique_nomenclature_per_plan; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_lines
    ADD CONSTRAINT production_plan_lines_unique_nomenclature_per_plan UNIQUE (production_plan_id, nomenclature_id);


--
-- Name: production_plan_weeks production_plan_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_weeks
    ADD CONSTRAINT production_plan_weeks_pkey PRIMARY KEY (production_plan_week_id);


--
-- Name: production_plan_weeks production_plan_weeks_unique_week; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_weeks
    ADD CONSTRAINT production_plan_weeks_unique_week UNIQUE (production_plan_id, week_no);


--
-- Name: production_plans production_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plans
    ADD CONSTRAINT production_plans_pkey PRIMARY KEY (production_plan_id);


--
-- Name: production_plans production_plans_plan_month_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plans
    ADD CONSTRAINT production_plans_plan_month_unique UNIQUE (plan_month);


--
-- Name: production_week_lines production_week_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_week_lines
    ADD CONSTRAINT production_week_lines_pkey PRIMARY KEY (production_week_line_id);


--
-- Name: production_week_lines production_week_lines_unique_plan_line_per_week; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_week_lines
    ADD CONSTRAINT production_week_lines_unique_plan_line_per_week UNIQUE (production_plan_week_id, production_plan_line_id);


--
-- Name: route_step_equipment route_step_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_equipment
    ADD CONSTRAINT route_step_equipment_pkey PRIMARY KEY (step_equipment_id);


--
-- Name: route_step_equipment route_step_equipment_route_step_id_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_equipment
    ADD CONSTRAINT route_step_equipment_route_step_id_machine_id_key UNIQUE (route_step_id, machine_id);


--
-- Name: route_step_inputs route_step_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_inputs
    ADD CONSTRAINT route_step_inputs_pkey PRIMARY KEY (step_input_id);


--
-- Name: route_steps route_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_steps
    ADD CONSTRAINT route_steps_pkey PRIMARY KEY (route_step_id);


--
-- Name: route_steps route_steps_route_id_step_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_steps
    ADD CONSTRAINT route_steps_route_id_step_no_key UNIQUE (route_id, step_no);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (route_id);


--
-- Name: routes routes_route_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_route_code_key UNIQUE (route_code);


--
-- Name: safety_stock safety_stock_nomenclature_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_stock
    ADD CONSTRAINT safety_stock_nomenclature_id_key UNIQUE (nomenclature_id);


--
-- Name: safety_stock safety_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_stock
    ADD CONSTRAINT safety_stock_pkey PRIMARY KEY (safety_stock_id);


--
-- Name: sales_plan sales_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_plan
    ADD CONSTRAINT sales_plan_pkey PRIMARY KEY (sales_plan_id);


--
-- Name: sales_plan sales_plan_plan_date_nomenclature_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_plan
    ADD CONSTRAINT sales_plan_plan_date_nomenclature_key UNIQUE (plan_date, nomenclature_id);


--
-- Name: idx_inventory_balance_as_of_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_balance_as_of_date ON public.inventory_balance USING btree (as_of_date);


--
-- Name: idx_sales_plan_plan_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_plan_plan_date ON public.sales_plan USING btree (plan_date);


--
-- Name: production_plan_lines trg_validate_production_plan_line_nomenclature; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_production_plan_line_nomenclature BEFORE INSERT OR UPDATE ON public.production_plan_lines FOR EACH ROW EXECUTE FUNCTION public.validate_production_plan_line_nomenclature();


--
-- Name: inventory_balance inventory_balance_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: production_plan_lines production_plan_lines_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_lines
    ADD CONSTRAINT production_plan_lines_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: production_plan_lines production_plan_lines_production_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_lines
    ADD CONSTRAINT production_plan_lines_production_plan_id_fkey FOREIGN KEY (production_plan_id) REFERENCES public.production_plans(production_plan_id) ON DELETE CASCADE;


--
-- Name: production_plan_weeks production_plan_weeks_production_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_plan_weeks
    ADD CONSTRAINT production_plan_weeks_production_plan_id_fkey FOREIGN KEY (production_plan_id) REFERENCES public.production_plans(production_plan_id) ON DELETE CASCADE;


--
-- Name: production_week_lines production_week_lines_production_plan_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_week_lines
    ADD CONSTRAINT production_week_lines_production_plan_line_id_fkey FOREIGN KEY (production_plan_line_id) REFERENCES public.production_plan_lines(production_plan_line_id) ON DELETE CASCADE;


--
-- Name: production_week_lines production_week_lines_production_plan_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_week_lines
    ADD CONSTRAINT production_week_lines_production_plan_week_id_fkey FOREIGN KEY (production_plan_week_id) REFERENCES public.production_plan_weeks(production_plan_week_id) ON DELETE CASCADE;


--
-- Name: production_week_lines production_week_lines_route_step_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_week_lines
    ADD CONSTRAINT production_week_lines_route_step_equipment_id_fkey FOREIGN KEY (route_step_equipment_id) REFERENCES public.route_step_equipment(step_equipment_id);


--
-- Name: route_step_equipment route_step_equipment_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_equipment
    ADD CONSTRAINT route_step_equipment_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(machine_id);


--
-- Name: route_step_equipment route_step_equipment_route_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_equipment
    ADD CONSTRAINT route_step_equipment_route_step_id_fkey FOREIGN KEY (route_step_id) REFERENCES public.route_steps(route_step_id);


--
-- Name: route_step_inputs route_step_inputs_input_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_inputs
    ADD CONSTRAINT route_step_inputs_input_nomenclature_id_fkey FOREIGN KEY (input_nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: route_step_inputs route_step_inputs_route_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_step_inputs
    ADD CONSTRAINT route_step_inputs_route_step_id_fkey FOREIGN KEY (route_step_id) REFERENCES public.route_steps(route_step_id);


--
-- Name: route_steps route_steps_output_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_steps
    ADD CONSTRAINT route_steps_output_nomenclature_id_fkey FOREIGN KEY (output_nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: route_steps route_steps_process_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_steps
    ADD CONSTRAINT route_steps_process_id_fkey FOREIGN KEY (process_id) REFERENCES public.processes(process_id);


--
-- Name: route_steps route_steps_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_steps
    ADD CONSTRAINT route_steps_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(route_id);


--
-- Name: routes routes_result_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_result_nomenclature_id_fkey FOREIGN KEY (result_nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: safety_stock safety_stock_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_stock
    ADD CONSTRAINT safety_stock_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- Name: sales_plan sales_plan_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_plan
    ADD CONSTRAINT sales_plan_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.nomenclature(nomenclature_id);


--
-- PostgreSQL database dump complete
--

\unrestrict hkKWRkiWZRhnf4poaSazFihmjlIa5rIsMVTMgCHm1iMjzaFoJ56BtEMFOPq7cJa

