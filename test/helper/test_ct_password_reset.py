import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

p=Path(__file__).resolve().parents[2]/'scripts'/'ct-password-reset-helper.py'
spec=importlib.util.spec_from_file_location('helper',p)
h=importlib.util.module_from_spec(spec); spec.loader.exec_module(h)

class Tests(unittest.TestCase):
 def test_request_is_bounded_and_only_accepts_fixed_root_password_operation(self):
  import json
  for value in [{}, {'vmid':True,'password':'a'*12}, {'vmid':'123; id','password':'a'*12}, {'vmid':123,'password':'short'}, {'vmid':123,'password':'a'*12+'\nroot:injected'}, {'vmid':123,'password':'a'*201}, {'vmid':123,'password':'a'*12,'command':'id'}]:
   with self.assertRaises(h.Refused): h.read_request(io.BytesIO(json.dumps(value).encode()))
  with self.assertRaises(h.Refused): h.read_request(io.BytesIO(b'x'*2049))
  self.assertEqual(h.read_request(io.BytesIO(b'{"vmid":123,"password":"abc$();: def123"}')),(123,'abc$();: def123'))

 @patch.object(h.socket,'gethostname',return_value='pve1')
 def test_requires_local_pool_member_unprivileged_unlocked_running_ct(self,_):
  member={'vmid':123,'type':'lxc','node':'pve1'}
  for members in [[],[{**member,'type':'qemu'}],[{**member,'node':'pve2'}],[{**member,'vmid':124}]]:
   with patch.object(h,'platform_json',return_value={'members':members}), self.assertRaises(h.Refused): h.eligible(123,'customers')
  for cfg in [{'unprivileged':0},{'unprivileged':1,'template':1},{'unprivileged':1,'lock':'backup'}]:
   with patch.object(h,'platform_json',side_effect=[{'members':[member]},cfg]), self.assertRaises(h.Refused): h.eligible(123,'customers')
  with patch.object(h,'platform_json',side_effect=[{'members':[member]},{'unprivileged':1}]), patch.object(h,'run',return_value=subprocess.CompletedProcess([],0,'status: stopped','')), self.assertRaises(h.Refused): h.eligible(123,'customers')
  with patch.object(h,'platform_json',side_effect=[{'members':[member]},{'unprivileged':1}]), patch.object(h,'run',return_value=subprocess.CompletedProcess([],0,'status: running','')): h.eligible(123,'customers')

 def test_password_is_only_stdin_and_command_is_not_tenant_controlled(self):
  password='abc$();: def123'
  with patch.object(h,'eligible'), patch.object(h,'run',return_value=subprocess.CompletedProcess([],0,'','')) as run:
   h.change_password(123,password,'customers')
   args,kwargs=run.call_args
   self.assertEqual(args[0],['/usr/sbin/pct','exec','123','--','/usr/sbin/chpasswd'])
   self.assertEqual(kwargs['input'],'root:'+password+'\n')
   self.assertNotIn(password,str(args))

 def test_ssh_refuses_arbitrary_commands_before_touching_configuration(self):
  with patch.object(h.os,'geteuid',return_value=0), patch.dict(h.os.environ,{'SSH_ORIGINAL_COMMAND':'id'}), patch.object(h.Path,'read_text') as read, patch('sys.stdout',new_callable=io.StringIO) as out:
   self.assertEqual(h.main(),1); read.assert_not_called(); self.assertEqual(out.getvalue().strip(),'{"error": "not_allowed"}')

if __name__=='__main__': unittest.main()
