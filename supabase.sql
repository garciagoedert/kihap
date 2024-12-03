-- Tabela para eventos KIHAP
CREATE TABLE IF NOT EXISTS kihap_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255) NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_kihap_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kihap_events_updated_at
  BEFORE UPDATE ON kihap_events
  FOR EACH ROW
  EXECUTE FUNCTION update_kihap_events_updated_at();

-- Tabela para checkins em eventos
CREATE TABLE IF NOT EXISTS event_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES kihap_events(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, student_id)
);

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_event_checkins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_checkins_updated_at
  BEFORE UPDATE ON event_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_event_checkins_updated_at();

-- Políticas de segurança para eventos KIHAP
CREATE POLICY "Eventos visíveis para todos os usuários autenticados"
  ON kihap_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas instrutores e admin podem criar eventos"
  ON kihap_events
  FOR INSERT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM users 
      WHERE role IN ('instructor', 'admin')
    )
  );

CREATE POLICY "Apenas instrutores e admin podem atualizar eventos"
  ON kihap_events
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM users 
      WHERE role IN ('instructor', 'admin')
    )
  );

CREATE POLICY "Apenas instrutores e admin podem deletar eventos"
  ON kihap_events
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM users 
      WHERE role IN ('instructor', 'admin')
    )
  );

-- Políticas de segurança para checkins
CREATE POLICY "Checkins visíveis para todos os usuários autenticados"
  ON event_checkins
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Alunos podem fazer checkin"
  ON event_checkins
  FOR INSERT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM users 
      WHERE role = 'student'
    )
  );

-- Views para facilitar consultas
CREATE OR REPLACE VIEW event_checkins_with_details AS
SELECT 
  ec.*,
  s.name as student_name,
  s.belt as student_belt,
  ke.name as event_name,
  ke.date as event_date,
  ke.location as event_location
FROM event_checkins ec
JOIN students s ON ec.student_id = s.id
JOIN kihap_events ke ON ec.event_id = ke.id;

-- Função para verificar se um aluno pode fazer checkin em um evento
CREATE OR REPLACE FUNCTION can_student_checkin(
  p_event_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_event_date TIMESTAMP WITH TIME ZONE;
  v_now TIMESTAMP WITH TIME ZONE;
  v_has_checkin BOOLEAN;
BEGIN
  -- Pega a data do evento
  SELECT date INTO v_event_date
  FROM kihap_events
  WHERE id = p_event_id;

  -- Pega a data/hora atual
  v_now := CURRENT_TIMESTAMP;

  -- Verifica se já existe checkin
  SELECT EXISTS (
    SELECT 1 
    FROM event_checkins 
    WHERE event_id = p_event_id AND student_id = p_student_id
  ) INTO v_has_checkin;

  -- Retorna true se:
  -- 1. O evento existe
  -- 2. Não tem checkin ainda
  -- 3. Está dentro da janela de 2 horas antes/depois do evento
  RETURN v_event_date IS NOT NULL 
    AND NOT v_has_checkin
    AND ABS(EXTRACT(EPOCH FROM (v_event_date - v_now))/3600) <= 2;
END;
$$ LANGUAGE plpgsql;
