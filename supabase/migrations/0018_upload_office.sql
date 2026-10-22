-- v0.25.5: ingevulde formulieren mogen ook als Excel of Word geüpload worden (bijv. indiensttredingsformulier)
update storage.buckets
set allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']
where id = 'hr-documenten';
