-- Migration 019: per-project pricing overrides (non-destructive, fallback design)
CREATE TABLE IF NOT EXISTS project_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    my_cost_per_sqm DECIMAL(10,2) NOT NULL,
    factor DECIMAL(10,3) NOT NULL,
    UNIQUE(project_id, name)
);
CREATE TABLE IF NOT EXISTS project_motors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    my_cost_per_unit DECIMAL(10,2) NOT NULL,
    factor DECIMAL(10,3) NOT NULL,
    UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_proj_products ON project_products(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_motors ON project_motors(project_id);

ALTER TABLE project_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_motors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_project_products ON project_products;
CREATE POLICY admin_all_project_products ON project_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
DROP POLICY IF EXISTS admin_all_project_motors ON project_motors;
CREATE POLICY admin_all_project_motors ON project_motors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
