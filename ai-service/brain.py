import numpy as np
import os

class QLearningAgent:
    def __init__(self, filename="q_table.npy"):
        self.filename = filename

        # moisture(18), stage(4), temp(16), air_h(19), actions(5)
        self.q_shape = (18, 4, 16, 19, 5) 
        
        # 2. SELEÇÃO DE 5 AÇÕES (-30%, -15%, 0%, +15%, +30%)
        self.actions = [0.70, 0.85, 1.0, 1.15, 1.3]

        self.learning_rate = 0.3    
        self.discount_factor = 0.90 

        # Exploração via Softmax
        self.temperature = 1.5
        self.min_temperature = 0.3
        self.decay_step = (1.5 - 0.3) / 100 


        self.step_count = 0
        
        self.load_q_table()

    def softmax(self, q_values, temperature=1.0):
      
        q_values = np.array(q_values)
        q_values = q_values - np.max(q_values)
        exp_q = np.exp(q_values / temperature)
        return exp_q / np.sum(exp_q)

    def get_state(self, moisture, stage, temp, air_h):
       
        m_idx = int(np.clip((moisture - 34) // 2, 0, 17)) # 34L (WP) a 68L (FC) de 2 em 2 Litros
        s_idx = int(np.clip(stage, 0, 3))                 # 4 estágios da alface
        t_idx = int(np.clip((temp - 5) // 2, 0, 15))      # 5°C a 35°C de 2 em 2 graus
        ah_idx = int(np.clip((air_h - 10) // 5, 0, 18))   # 10% a 100% de 5 em 5%
        return m_idx, s_idx, t_idx, ah_idx

    def load_q_table(self):
     
        if os.path.exists(self.filename):
            try:
                self.q_table = np.load(self.filename)
                if self.q_table.shape != self.q_shape:
                    self.reset_memory()
            except Exception:
                self.reset_memory()
        else:
            self.reset_memory()

    def reset_memory(self):
      
        self.q_table = np.zeros(self.q_shape)
        np.save(self.filename, self.q_table)

    def decide(self, m, s, t, ah, modo_treino=False):

        state = self.get_state(m, s, t, ah)
        
        q_values = np.copy(self.q_table[state])
        
        if modo_treino:
            probs = self.softmax(q_values, temperature=self.temperature)
            action_idx = np.random.choice(len(self.actions), p=probs)

        else:
            
            action_idx = np.argmax(q_values)

        return int(action_idx), self.actions[action_idx]

    def learn(self, state_tuple, action_idx, reward, next_state_tuple):
        s_m, s_s, s_t, s_ah = map(int, state_tuple)
        n_m, n_s, n_t, n_ah = map(int, next_state_tuple)
        a_idx = int(action_idx)

        old_value = self.q_table[s_m, s_s, s_t, s_ah, a_idx]
        next_max = np.max(self.q_table[n_m, n_s, n_t, n_ah])

        td_target = reward + self.discount_factor * next_max
        td_error = td_target - old_value

        self.q_table[s_m, s_s, s_t, s_ah, a_idx] = old_value + self.learning_rate * td_error

        # Salva o progresso no arquivo npy
        np.save(self.filename, self.q_table)

        # Controle de decaimento do ruído/temperatura de exploração
        self.step_count += 1
        if self.step_count % 50 == 0:
            self.temperature = max(
                0.15, 
                self.temperature * 0.99235
            )