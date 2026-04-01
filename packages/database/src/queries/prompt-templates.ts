import type { SupabaseClient } from '@supabase/supabase-js';
import type { Platform } from '@influenceai/core';

export interface PromptTemplate {
  id: string;
  pillarId: string;
  platform: Platform;
  templateType: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelOverride?: string;
}

export async function getActiveTemplate(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<PromptTemplate | null> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    pillarId: data.pillar_id,
    platform: data.platform as Platform,
    templateType: data.template_type,
    systemPrompt: data.system_prompt,
    userPromptTemplate: data.user_prompt_template,
    modelOverride: data.model_override,
  };
}

export async function insertPromptTemplate(
  client: SupabaseClient,
  template: Omit<PromptTemplate, 'id'>,
): Promise<string> {
  const { data, error } = await client
    .from('prompt_templates')
    .insert({
      pillar_id: template.pillarId,
      platform: template.platform,
      template_type: template.templateType,
      system_prompt: template.systemPrompt,
      user_prompt_template: template.userPromptTemplate,
      model_override: template.modelOverride,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert prompt template: ${error.message}`);
  return data!.id;
}

export interface PromptTemplateRow {
  id: string;
  pillar_id: string;
  platform: string;
  template_type: string;
  system_prompt: string;
  user_prompt_template: string;
  model_override: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listActiveTemplates(
  client: SupabaseClient,
): Promise<PromptTemplateRow[]> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true)
    .order('pillar_id', { ascending: true })
    .order('platform', { ascending: true });
  if (error) throw new Error(`Failed to list templates: ${error.message}`);
  return (data ?? []) as PromptTemplateRow[];
}

export async function getTemplateVersions(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<PromptTemplateRow[]> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType)
    .order('version', { ascending: false });
  if (error) throw new Error(`Failed to get template versions: ${error.message}`);
  return (data ?? []) as PromptTemplateRow[];
}

export async function deactivateTemplates(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<void> {
  const { error } = await client
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType);
  if (error) throw new Error(`Failed to deactivate templates: ${error.message}`);
}
